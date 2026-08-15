import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import vercelConfig from "../vercel.json";
import type { OwnerPost } from "./domain";
import { buildPostSharePayload, modelKeyFor } from "./insights";
import { accountPaths, workspacePaths } from "./routing";
import {
  buildDeepLink,
  citySlugFor,
  deepLinkPathFor,
  defaultShareOrigin,
  formatShareText,
  modelSlugFor,
  sharePaths,
  sharePayloadFor,
  shareContent,
  shareOrCopy,
  shareResultMessage,
  type ShareEnvironment,
  type ShareResult,
  type SharePayloadWithUrl,
} from "./share";

const origin = "https://autoflex.test";
const options = { origin };

const samplePost: OwnerPost = {
  id: "note-42",
  title: "Clutch replaced at 61,000 km",
  author: "Ritu",
  brand: "Maruti Suzuki",
  model: "Swift",
  variant: "ZXi",
  city: "Pune",
  odometerKm: 61000,
  label: "Cost note",
  topic: "Transmission",
  body: "City traffic ate the clutch early. Authorised service quoted more than twice the local specialist.",
  createdAt: "2026-03-04T10:00:00.000Z",
  helpful: 12,
  fixesConfirmed: 3,
  comments: [],
};

const payload: SharePayloadWithUrl = {
  title: "Autoflex",
  text: "Owner notes",
  url: `${origin}/community/note-42`,
};

describe("deep links", () => {
  it("derives every primary path from the router tables so they cannot drift", () => {
    expect(sharePaths).toMatchObject(workspacePaths);
    expect(sharePaths).toMatchObject(accountPaths);

    for (const [screen, path] of Object.entries(workspacePaths)) {
      expect(deepLinkPathFor(screen as keyof typeof workspacePaths)).toBe(path);
    }
    for (const [view, path] of Object.entries(accountPaths)) {
      expect(deepLinkPathFor(view as keyof typeof accountPaths)).toBe(path);
    }
  });

  it("builds absolute canonical URLs for screens and the composer", () => {
    expect(buildDeepLink("home", {}, options)).toBe(`${origin}/`);
    expect(buildDeepLink("garage", {}, options)).toBe(`${origin}/garage`);
    expect(buildDeepLink("saved", {}, options)).toBe(`${origin}/profile/saved`);
    expect(buildDeepLink("compose", {}, options)).toBe(`${origin}/community/new`);
  });

  it("builds detail routes for posts, cars, playbooks and cities", () => {
    expect(buildDeepLink("post", { postId: "note-42" }, options)).toBe(`${origin}/community/note-42`);
    expect(buildDeepLink("car", { brand: "Tata", model: "Nexon EV" }, options)).toBe(`${origin}/cars/tata-nexon-ev`);
    expect(buildDeepLink("playbook", { brand: "Kia", model: "Seltos" }, options)).toBe(
      `${origin}/playbooks/kia-seltos`,
    );
    expect(buildDeepLink("city", { city: "New Delhi" }, options)).toBe(`${origin}/cities/new-delhi`);
  });

  it("keeps model slugs identical to insights.modelKeyFor", () => {
    const pairs: Array<[string, string]> = [
      ["Maruti Suzuki", "Grand Vitara"],
      ["Tata", "Nexon EV"],
      ["MG", "ZS EV"],
      ["Toyota", "Urban Cruiser Hyryder"],
    ];

    for (const [brand, model] of pairs) {
      const key = modelKeyFor(brand, model);
      expect(modelSlugFor(brand, model)).toBe(key);
      expect(buildDeepLink("car", { brand, model }, options)).toBe(`${origin}/cars/${key}`);
      expect(buildDeepLink("playbook", { brand, model }, options)).toBe(`${origin}/playbooks/${key}`);
    }
  });

  it("refuses path traversal and other hostile slugs", () => {
    expect(buildDeepLink("post", { postId: "../../etc/passwd" }, options)).toBe(`${origin}/community`);
    expect(buildDeepLink("car", { slug: "../admin" }, options)).toBe(`${origin}/shortlist`);
    expect(buildDeepLink("city", { slug: "..%2f..%2fadmin" }, options)).toBe(`${origin}/community`);
    expect(buildDeepLink("playbook", { slug: "a/b" }, options)).toBe(`${origin}/community`);
    expect(buildDeepLink("post", { postId: "note 42" }, options)).toBe(`${origin}/community`);
    expect(buildDeepLink("post", { postId: "a".repeat(200) }, options)).toBe(`${origin}/community`);
  });

  it("degrades to the parent screen instead of emitting a broken path", () => {
    expect(buildDeepLink("post", {}, options)).toBe(`${origin}/community`);
    expect(buildDeepLink("car", { brand: "", model: "" }, options)).toBe(`${origin}/shortlist`);
    expect(buildDeepLink("city", { city: "   " }, options)).toBe(`${origin}/community`);
    // `new` is the composer route, never a post id.
    expect(buildDeepLink("post", { postId: "new" }, options)).toBe(`${origin}/community`);
  });

  it("never carries personal data in the query string", () => {
    const link = buildDeepLink(
      "post",
      { postId: "note-42", ref: "ritu@example.com" } as never,
      options,
    );
    expect(link).toBe(`${origin}/community/note-42`);
    expect(link).not.toContain("@");
    expect(buildDeepLink("post", { postId: "note-42", ref: "share" }, options)).toBe(
      `${origin}/community/note-42?ref=share`,
    );
    expect(buildDeepLink("post", { postId: "note-42", ref: "utm_source" }, options)).not.toContain("?");
  });

  it("treats the origin as configurable and falls back safely", () => {
    expect(buildDeepLink("garage", {}, { origin: "https://autoflex.example.com/" })).toBe(
      "https://autoflex.example.com/garage",
    );
    expect(buildDeepLink("garage", {}, { origin: "javascript:alert(1)" })).toBe(`${defaultShareOrigin}/garage`);
    expect(buildDeepLink("garage", {}, { origin: "not a url" })).toBe(`${defaultShareOrigin}/garage`);
    expect(buildDeepLink("garage")).toBe(`${defaultShareOrigin}/garage`);
  });

  it("normalises city names into slugs", () => {
    expect(citySlugFor("New Delhi")).toBe("new-delhi");
    expect(citySlugFor("  Bengaluru  ")).toBe("bengaluru");
    expect(citySlugFor("!!!")).toBeNull();
  });
});

describe("share payloads", () => {
  it("keeps post copy identical to insights.buildPostSharePayload", () => {
    const shared = sharePayloadFor({ kind: "post", post: samplePost }, options);
    const existing = buildPostSharePayload(samplePost);

    expect(shared.title).toBe(existing.title);
    expect(shared.text).toBe(existing.text);
    expect(shared.url).toBe(`${origin}/community/note-42?ref=share`);
  });

  it("shapes car, vehicle, city, playbook and screen payloads", () => {
    const car = sharePayloadFor(
      { kind: "car", car: { brand: "Hyundai", model: "Creta", budget: 1650000, status: "Test drive" } },
      options,
    );
    expect(car.title).toBe("Hyundai Creta on Autoflex");
    expect(car.text).toContain("Test drive");
    expect(car.url).toBe(`${origin}/cars/hyundai-creta?ref=share`);

    // A garage entry is private, so it shares the public model page.
    const vehicle = sharePayloadFor(
      {
        kind: "vehicle",
        vehicle: { brand: "Tata", city: "Pune", model: "Nexon", nickname: "Blue", odometerKm: 42000, variant: "XZ+" },
      },
      options,
    );
    expect(vehicle.title).toBe("Blue — Tata Nexon");
    expect(vehicle.url).toBe(`${origin}/cars/tata-nexon?ref=share`);
    expect(vehicle.url).not.toContain("/garage");

    const city = sharePayloadFor(
      { kind: "city", city: { city: "Pune", localSignal: "Hot", topBrands: ["Tata", "Maruti Suzuki"], postCount: 7 } },
      options,
    );
    expect(city.title).toBe("Pune owner circle on Autoflex");
    expect(city.text).toContain("7 owner notes");
    expect(city.url).toBe(`${origin}/cities/pune?ref=share`);

    const playbook = sharePayloadFor(
      {
        kind: "playbook",
        playbook: {
          brand: "Kia",
          confidence: "Strong pattern",
          evidenceCount: 9,
          headline: "Owners rate the DCT service plan as the deciding cost.",
          model: "Seltos",
        },
      },
      options,
    );
    expect(playbook.title).toBe("Kia Seltos ownership playbook");
    expect(playbook.text).toContain("9 owner notes");
    expect(playbook.url).toBe(`${origin}/playbooks/kia-seltos?ref=share`);

    const screen = sharePayloadFor({ kind: "screen", screen: "community" }, options);
    expect(screen.title).toBe("Owner notes · Autoflex");
    expect(screen.url).toBe(`${origin}/community?ref=share`);
  });

  it("formats a plain-text fallback that always includes the link", () => {
    const shared = sharePayloadFor({ kind: "post", post: samplePost }, options);
    expect(formatShareText(shared)).toContain(shared.url);
    expect(formatShareText(shared).startsWith(shared.title)).toBe(true);
  });
});

const environmentFor = (overrides: Partial<ShareEnvironment>): ShareEnvironment => ({
  document: null,
  navigator: null,
  prompt: null,
  ...overrides,
});

describe("share fallback ladder", () => {
  it("uses Web Share when the browser accepts the payload", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const result = await shareOrCopy(payload, environmentFor({ navigator: { canShare, share } }));

    expect(result).toEqual({ status: "shared", via: "web-share" });
    expect(canShare).toHaveBeenCalledWith({ text: payload.text, title: payload.title, url: payload.url });
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a user cancelling the share sheet from a failure", async () => {
    const abort = Object.assign(new Error("Share canceled"), { name: "AbortError" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareOrCopy(
      payload,
      environmentFor({ navigator: { clipboard: { writeText }, share: vi.fn().mockRejectedValue(abort) } }),
    );

    expect(result).toEqual({ status: "cancelled", via: "web-share" });
    // A cancellation must not silently copy behind the user's back.
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard when canShare rejects the payload", async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareOrCopy(
      payload,
      environmentFor({ navigator: { canShare: () => false, clipboard: { writeText }, share } }),
    );

    expect(share).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "copied", via: "clipboard" });
    expect(writeText).toHaveBeenCalledWith(formatShareText(payload));
  });

  it("falls back to the clipboard when Web Share fails for a non-cancellation reason", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareOrCopy(
      payload,
      environmentFor({
        navigator: {
          clipboard: { writeText },
          share: vi.fn().mockRejectedValue(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" })),
        },
      }),
    );

    expect(result).toEqual({ status: "copied", via: "clipboard" });
  });

  it("falls back to execCommand when the clipboard API is blocked", async () => {
    const element = { select: vi.fn(), setAttribute: vi.fn(), style: {} as Record<string, string>, value: "" };
    const execCommand = vi.fn().mockReturnValue(true);
    const appendChild = vi.fn();
    const removeChild = vi.fn();

    const result = await shareOrCopy(
      payload,
      environmentFor({
        document: {
          body: { appendChild, removeChild },
          createElement: () => element,
          execCommand,
        },
        navigator: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } },
      }),
    );

    expect(result).toEqual({ status: "copied", via: "legacy-copy" });
    expect(element.value).toBe(formatShareText(payload));
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(removeChild).toHaveBeenCalledWith(element);
    // CSP forbids inline styles, so positioning must go through CSSOM, not setAttribute("style").
    expect(element.setAttribute).not.toHaveBeenCalledWith("style", expect.anything());
  });

  it("falls back to prompt, and reports a dismissed prompt as cancelled", async () => {
    const prompt = vi.fn().mockReturnValue(payload.url);
    expect(await shareOrCopy(payload, environmentFor({ prompt }))).toEqual({ status: "manual", via: "prompt" });
    expect(prompt).toHaveBeenCalledWith("Copy this Autoflex link", payload.url);

    expect(await shareOrCopy(payload, environmentFor({ prompt: vi.fn().mockReturnValue(null) }))).toEqual({
      status: "cancelled",
      via: "prompt",
    });
  });

  it("reports unsupported environments instead of throwing", async () => {
    expect(await shareOrCopy(payload, environmentFor({}))).toEqual({ status: "unsupported" });
  });

  it("never throws, even when the environment misbehaves", async () => {
    const hostile = {
      get navigator() {
        throw new Error("navigator exploded");
      },
    } as unknown as ShareEnvironment;

    const result = await shareOrCopy(payload, hostile);
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.reason).toBe("navigator exploded");
  });

  it("shares content end to end through the convenience wrapper", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await shareContent(
      { kind: "post", post: samplePost },
      { environment: environmentFor({ navigator: { share } }), origin },
    );

    expect(result).toEqual({ status: "shared", via: "web-share" });
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${origin}/community/note-42?ref=share` }),
    );
  });

  it("has ready-made action-bar copy for every result", () => {
    const results: ShareResult[] = [
      { status: "shared", via: "web-share" },
      { status: "copied", via: "clipboard" },
      { status: "copied", via: "legacy-copy" },
      { status: "manual", via: "prompt" },
      { status: "cancelled", via: "web-share" },
      { status: "unsupported" },
      { status: "failed", reason: "boom" },
    ];

    for (const result of results) {
      const message = shareResultMessage(result);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain("undefined");
    }
    expect(shareResultMessage({ status: "copied", via: "clipboard" })).toBe("Link copied. Paste it anywhere.");
    expect(shareResultMessage({ status: "cancelled", via: "web-share" })).toBe("Sharing cancelled.");
  });
});

describe("crawler previews stay inside the security posture", () => {
  const policy = vercelConfig.headers[0].headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";

  it("keeps the strict CSP untouched", () => {
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("keeps the transport and framing headers untouched", () => {
    const keys = vercelConfig.headers[0].headers.map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy",
        "Permissions-Policy",
        "Referrer-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
      ]),
    );
  });

  it("gates the Open Graph function on social crawlers, before the SPA catch-all", () => {
    const [crawlerRule, spaRule] = vercelConfig.rewrites;

    expect(crawlerRule.destination).toBe("/api/og?path=/:path");
    expect(spaRule.destination).toBe("/index.html");

    const userAgentRule = crawlerRule.has?.find((rule) => rule.key === "user-agent");
    expect(userAgentRule?.type).toBe("header");
    // Social crawlers only. Search engines and humans must fall through to the SPA.
    const userAgentPattern = new RegExp(`^${userAgentRule?.value ?? "$^"}$`);
    const matches = (userAgent: string) => userAgentPattern.test(userAgent);

    expect(matches("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(matches("Mozilla/5.0 (compatible; Twitterbot/1.0)")).toBe(true);
    expect(matches("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(matches("Mozilla/5.0 (compatible; LinkedInBot/1.0; +https://www.linkedin.com)")).toBe(true);
    expect(matches("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);

    expect(matches("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(false);
    expect(matches("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(false);
    expect(matches("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(
      false,
    );

    // Static files (including /og-cover.png) must never be swallowed by the shim.
    expect(crawlerRule.source).toContain("\\.");
    expect(crawlerRule.missing?.[0]).toMatchObject({ key: "og", type: "query" });
  });

  it("varies document responses on User-Agent", () => {
    const varyRule = vercelConfig.headers.find((entry) =>
      entry.headers.some((header) => header.key === "Vary" && header.value === "User-Agent"),
    );
    expect(varyRule).toBeTruthy();
  });
});

describe("static Open Graph metadata", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  it("declares canonical, Open Graph and Twitter cards", () => {
    expect(html).toContain('<link rel="canonical"');
    expect(html).toContain('property="og:site_name" content="AutoFlex"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain("/og-cover.png");
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="theme-color" content="#141313"');
    expect(html).toMatch(/og:image:width" content="1200"/);
    expect(html).toMatch(/og:image:height" content="630"/);
  });

  it("keeps the canonical origin in sync with the share utility", () => {
    expect(html).toContain(`<link rel="canonical" href="${defaultShareOrigin}/" />`);
    expect(html).toContain(`content="${defaultShareOrigin}/og-cover.png"`);
  });

  it("ships no inline script or inline style, matching the CSP", () => {
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
  });
});
