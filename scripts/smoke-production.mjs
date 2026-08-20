#!/usr/bin/env node
/**
 * Production smoke test for the Autoflex web app.
 *
 * This is NOT a gate - Vercel has already promoted the deployment by the time
 * this runs (see docs/DEPLOYMENT.md, "What actually gates production"). It is a
 * detector: it exercises the user journeys that break in ways a build cannot
 * catch, and fails loudly so an operator rolls back.
 *
 * What it covers, and why each one exists:
 *   * deep routes (/community, /garage, /cars/:slug ...) - a bad `rewrites`
 *     entry in vercel.json turns every shared link into a 404 while `/` stays
 *     perfectly fine;
 *   * hashed assets referenced by the shipped index.html - proves the deployed
 *     HTML and the deployed asset set are from the same build;
 *   * /sw.js freshness - a long-lived cached service worker is how users get
 *     stuck on a stale shell for days;
 *   * security headers - vercel.json is edited by humans;
 *   * the crawler rewrite to /api/og - shared links are a primary acquisition
 *     path and the rewrite has its own failure mode;
 *   * Supabase reachability and feed latency - the app degrades to local data
 *     silently when Supabase is unreachable, so nothing else would notice.
 *
 * Usage:
 *   node scripts/smoke-production.mjs
 *   node scripts/smoke-production.mjs --wait               # poll first
 *   node scripts/smoke-production.mjs --url=http://127.0.0.1:4173
 *
 * Environment:
 *   PRODUCTION_URL      default https://moto-gp-chi.vercel.app
 *   COMMIT_SHA          commit expected to be live (used with VERCEL_TOKEN)
 *   VERCEL_TOKEN        optional; when set, waits for THIS commit's deployment
 *   VERCEL_PROJECT_ID   required with VERCEL_TOKEN
 *   VERCEL_TEAM_ID      optional team scope
 *   SMOKE_SUPABASE_URL  default https://uxzdmlqyxausmmdpmkrr.supabase.co
 *   SMOKE_SUPABASE_KEY  optional publishable key; enables the feed-latency probe
 *
 * Secrets are read from the environment and never printed.
 */

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const hit = args.find((entry) => entry.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (value("url", process.env.PRODUCTION_URL || "https://moto-gp-chi.vercel.app")).replace(/\/$/, "");
const COMMIT_SHA = process.env.COMMIT_SHA || process.env.GITHUB_SHA || "";
const SUPABASE_URL = (process.env.SMOKE_SUPABASE_URL || "https://uxzdmlqyxausmmdpmkrr.supabase.co").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SMOKE_SUPABASE_KEY || "";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "15000", 10);
const WAIT_TIMEOUT_MS = Number.parseInt(process.env.SMOKE_WAIT_TIMEOUT_MS || "600000", 10);

/** Latency budgets. Exceeding one is a warning: slow is not broken, but it is worth seeing. */
const BUDGET_MS = { asset: 1500, feed: 800, html: 2000 };

const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "manual",
      ...options,
      headers: { "user-agent": "autoflex-smoke/1.0", ...(options.headers ?? {}) },
      signal: controller.signal,
    });
    return { durationMs: Date.now() - startedAt, response };
  } finally {
    clearTimeout(timer);
  }
};

const check = async (name, run) => {
  const startedAt = Date.now();
  try {
    const detail = await run();
    results.push({ detail: detail ?? "", durationMs: Date.now() - startedAt, name, status: "pass" });
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    const status = failure.startsWith("WARN:") ? "warn" : "fail";
    results.push({
      detail: failure.replace(/^WARN:\s*/, ""),
      durationMs: Date.now() - startedAt,
      name,
      status,
    });
  }
};

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const warnIf = (condition, message) => {
  if (condition) results.push({ detail: message, durationMs: 0, name: "budget", status: "warn" });
};

/* -------------------------------------------------------------------------- */
/* Wait for the deployment                                                     */
/* -------------------------------------------------------------------------- */

/** Ask Vercel whether THIS commit is the live production deployment. */
const waitForVercelDeployment = async () => {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId || !COMMIT_SHA) return null;

  const params = new URLSearchParams({
    limit: "20",
    projectId,
    target: "production",
  });
  if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);
  const url = `https://api.vercel.com/v6/deployments?${params.toString()}`;
  const deadline = Date.now() + WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { response } = await fetchWithTimeout(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.log(`  vercel api returned ${response.status}; falling back to polling the URL`);
      return null;
    }
    const body = await response.json();
    const match = (body.deployments ?? []).find((deployment) => deployment?.meta?.githubCommitSha === COMMIT_SHA);
    if (match?.readyState === "READY" || match?.state === "READY") {
      console.log(`  deployment for ${COMMIT_SHA.slice(0, 7)} is READY`);
      return true;
    }
    if (match?.readyState === "ERROR" || match?.state === "ERROR") {
      throw new Error(`Vercel build for ${COMMIT_SHA.slice(0, 7)} ended in ERROR.`);
    }
    console.log(`  waiting for ${COMMIT_SHA.slice(0, 7)} (state: ${match?.readyState ?? match?.state ?? "not queued yet"})`);
    await sleep(10000);
  }
  throw new Error(`Timed out waiting for the deployment of ${COMMIT_SHA.slice(0, 7)}.`);
};

/** Fallback: just wait until the origin answers 200 on `/`. */
const waitForOrigin = async () => {
  const deadline = Date.now() + Math.min(WAIT_TIMEOUT_MS, 300000);
  let lastStatus = "no response";
  while (Date.now() < deadline) {
    try {
      const { response } = await fetchWithTimeout(`${BASE}/`);
      if (response.status === 200) return true;
      lastStatus = `HTTP ${response.status}`;
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    await sleep(10000);
  }
  throw new Error(`Origin never returned 200 (${lastStatus}).`);
};

/* -------------------------------------------------------------------------- */
/* Checks                                                                      */
/* -------------------------------------------------------------------------- */

let indexHtml = "";

const run = async () => {
  console.log(`Smoke testing ${BASE}`);

  if (flag("wait")) {
    console.log("==> Waiting for the production deployment");
    const confirmed = await waitForVercelDeployment().catch((error) => {
      console.error(`  ${error.message}`);
      throw error;
    });
    if (confirmed === null) {
      console.log("  no VERCEL_TOKEN/PROJECT_ID/COMMIT_SHA: cannot confirm which commit is live.");
      console.log("  Polling the origin instead - a green result does NOT prove this commit is deployed.");
      await waitForOrigin();
    }
  }

  await check("app shell (/) returns the SPA", async () => {
    const { durationMs, response } = await fetchWithTimeout(`${BASE}/`);
    expect(response.status === 200, `expected 200, got ${response.status}`);
    indexHtml = await response.text();
    expect(indexHtml.includes('<div id="root">'), "index.html is missing the React mount point");
    expect(/<script[^>]+src="\/assets\//.test(indexHtml), "index.html references no hashed asset bundle");
    warnIf(durationMs > BUDGET_MS.html, `/ took ${durationMs}ms (budget ${BUDGET_MS.html}ms)`);
    return `${durationMs}ms, ${indexHtml.length} bytes`;
  });

  await check("hashed assets referenced by index.html resolve", async () => {
    const assets = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    expect(assets.length > 0, "no /assets/ references found in index.html");
    const seen = new Set();
    for (const asset of assets) {
      if (seen.has(asset)) continue;
      seen.add(asset);
      const { durationMs, response } = await fetchWithTimeout(`${BASE}${asset}`);
      expect(response.status === 200, `${asset} returned ${response.status} - HTML and assets are from different builds`);
      const cacheControl = response.headers.get("cache-control") ?? "";
      expect(
        cacheControl.includes("immutable") || cacheControl.includes("max-age=31536000"),
        `${asset} is content-hashed but served with cache-control: ${cacheControl || "(none)"}`,
      );
      warnIf(durationMs > BUDGET_MS.asset, `${asset} took ${durationMs}ms`);
    }
    return `${seen.size} asset(s) verified`;
  });

  const deepRoutes = ["/community", "/garage", "/shortlist", "/vault", "/profile/settings", "/cars/tata-nexon"];
  await check("deep links serve the app shell, not a 404", async () => {
    const broken = [];
    for (const route of deepRoutes) {
      const { response } = await fetchWithTimeout(`${BASE}${route}`);
      const body = response.status === 200 ? await response.text() : "";
      if (response.status !== 200 || !body.includes('<div id="root">')) {
        broken.push(`${route} -> ${response.status}`);
      }
    }
    expect(broken.length === 0, `SPA rewrite is broken for: ${broken.join(", ")}`);
    return `${deepRoutes.length} routes served the shell`;
  });

  await check("service worker is served and revalidates", async () => {
    const { response } = await fetchWithTimeout(`${BASE}/sw.js`);
    expect(response.status === 200, `/sw.js returned ${response.status}`);
    const body = await response.text();
    expect(body.includes("CACHE_NAME"), "/sw.js is not the generated Autoflex worker");
    const cacheControl = (response.headers.get("cache-control") ?? "").toLowerCase();
    expect(
      !cacheControl.includes("immutable"),
      `/sw.js must not be immutable (got: ${cacheControl}) - users would never receive an update`,
    );
    const maxAge = /max-age=(\d+)/.exec(cacheControl);
    if (maxAge && Number.parseInt(maxAge[1], 10) > 3600) {
      throw new Error(`WARN: /sw.js max-age=${maxAge[1]}s delays updates by up to that long`);
    }
    return `cache-control: ${cacheControl || "(none)"}`;
  });

  await check("PWA manifest is valid", async () => {
    const { response } = await fetchWithTimeout(`${BASE}/manifest.json`);
    expect(response.status === 200, `/manifest.json returned ${response.status}`);
    const manifest = JSON.parse(await response.text());
    expect(Array.isArray(manifest.icons) && manifest.icons.length > 0, "manifest has no icons");
    expect(typeof manifest.start_url === "string", "manifest has no start_url");
    for (const icon of manifest.icons) {
      const { response: iconResponse } = await fetchWithTimeout(`${BASE}${icon.src}`);
      expect(iconResponse.status === 200, `icon ${icon.src} returned ${iconResponse.status}`);
    }
    return `${manifest.icons.length} icon(s) resolved`;
  });

  await check("security headers present on the shell", async () => {
    const { response } = await fetchWithTimeout(`${BASE}/`);
    const required = [
      "content-security-policy",
      "strict-transport-security",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
    ];
    const missing = required.filter((header) => !response.headers.get(header));
    expect(missing.length === 0, `missing header(s): ${missing.join(", ")}`);
    return required.length + " headers verified";
  });

  await check("crawler rewrite serves OG markup", async () => {
    const { response } = await fetchWithTimeout(`${BASE}/community`, {
      headers: { "user-agent": "facebookexternalhit/1.1" },
    });
    expect(response.status === 200, `crawler request returned ${response.status}`);
    const body = await response.text();
    expect(body.includes('property="og:title"'), "crawler response has no og:title");
    return "og:title present";
  });

  await check("Supabase edge is reachable", async () => {
    const { durationMs, response } = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/`);
    // Without an apikey PostgREST answers 401; that still proves DNS, TLS and
    // the project are alive. A 5xx or a network error does not.
    expect(response.status < 500, `Supabase returned ${response.status}`);
    return `HTTP ${response.status} in ${durationMs}ms`;
  });

  if (SUPABASE_KEY) {
    await check("public feed query", async () => {
      const { durationMs, response } = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/owner_posts?select=id,created_at&order=created_at.desc&limit=10`,
        { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } },
      );
      expect(response.status === 200, `feed query returned ${response.status}`);
      const rows = await response.json();
      expect(Array.isArray(rows), "feed query did not return rows");
      warnIf(durationMs > BUDGET_MS.feed, `feed query took ${durationMs}ms (budget ${BUDGET_MS.feed}ms)`);
      return `${rows.length} row(s) in ${durationMs}ms`;
    });
  } else {
    results.push({
      detail: "set SMOKE_SUPABASE_KEY to measure real feed latency",
      durationMs: 0,
      name: "public feed query",
      status: "skip",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

let exitCode = 0;
try {
  await run();
} catch (error) {
  results.push({
    detail: error instanceof Error ? error.message : String(error),
    durationMs: 0,
    name: "deployment wait",
    status: "fail",
  });
}

const icon = { fail: "FAIL", pass: "pass", skip: "skip", warn: "WARN" };
console.log("\n--- results ---");
for (const item of results) {
  console.log(`${icon[item.status].padEnd(4)}  ${item.name}${item.detail ? `  (${item.detail})` : ""}`);
}

const failures = results.filter((item) => item.status === "fail");
const warnings = results.filter((item) => item.status === "warn");
console.log(`\n${results.length - failures.length - warnings.length} passed, ${warnings.length} warning(s), ${failures.length} failure(s)`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  const rows = results.map((item) => `| ${icon[item.status]} | ${item.name} | ${item.detail || ""} |`);
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [`### Production smoke test - ${BASE}`, "", "| result | check | detail |", "| --- | --- | --- |", ...rows, ""].join("\n") + "\n",
  );
}

if (failures.length) exitCode = 1;
process.exit(exitCode);
