/**
 * Security regression tests for the hosted Fastify API (server-ts/**).
 *
 * Each test maps to a finding in docs/SECURITY_AUDIT.md.
 */
import { describe, expect, it } from "vitest";
import { buildAutoflexApi } from "../../server-ts/app";
import {
  createRateLimiter,
  DEFAULT_DEV_ORIGINS,
  MIN_ADMIN_TOKEN_LENGTH,
  presentedAdminToken,
  publicErrorMessage,
  resolveAdminToken,
  resolveAllowedOrigins,
  timingSafeEquals,
  WEAK_ADMIN_TOKENS,
} from "../../server-ts/security";

const STRONG_TOKEN = "sBq7-Xr2fN9tK4vZ1mPw8LcY";

describe("AF-04 admin token policy fails closed", () => {
  it("rejects the shipped default token", () => {
    expect(resolveAdminToken("dev-admin")).toEqual({ ok: false, reason: "weak" });
    expect(resolveAdminToken("DEV-ADMIN")).toEqual({ ok: false, reason: "weak" });
    expect(resolveAdminToken(" dev-admin ")).toEqual({ ok: false, reason: "weak" });
  });

  it("rejects every documented placeholder token", () => {
    for (const weak of WEAK_ADMIN_TOKENS) {
      expect(resolveAdminToken(weak).ok, `${weak} must not be accepted`).toBe(false);
    }
  });

  it("rejects a missing token and a short token", () => {
    expect(resolveAdminToken(undefined)).toEqual({ ok: false, reason: "missing" });
    expect(resolveAdminToken("")).toEqual({ ok: false, reason: "missing" });
    expect(resolveAdminToken("a".repeat(MIN_ADMIN_TOKEN_LENGTH - 1))).toEqual({ ok: false, reason: "short" });
  });

  it("accepts a long random token and flags the explicit dev escape hatch", () => {
    expect(resolveAdminToken(STRONG_TOKEN)).toEqual({ insecure: false, ok: true, token: STRONG_TOKEN });
    expect(resolveAdminToken("dev-admin", { allowInsecure: true })).toEqual({
      insecure: true,
      ok: true,
      token: "dev-admin",
    });
  });

  it("disables admin routes with 503 when no usable token is configured", async () => {
    const app = await buildAutoflexApi();
    const anonymous = await app.inject({ method: "GET", url: "/api/feedback" });
    expect(anonymous.statusCode).toBe(503);

    // The default token must not unlock anything, even when presented.
    const withDefault = await app.inject({
      headers: { "x-admin-token": "dev-admin" },
      method: "GET",
      url: "/api/feedback",
    });
    expect(withDefault.statusCode).toBe(503);
    expect(withDefault.json().error).toBe("Unavailable");
    await app.close();
  });

  it("still rejects the default token when a real token is configured", async () => {
    const app = await buildAutoflexApi({ adminToken: STRONG_TOKEN });
    expect((await app.inject({ headers: { "x-admin-token": "dev-admin" }, method: "GET", url: "/api/feedback" })).statusCode).toBe(401);
    expect((await app.inject({ headers: { authorization: "Bearer dev-admin" }, method: "GET", url: "/api/feedback" })).statusCode).toBe(401);
    expect((await app.inject({ headers: { "x-admin-token": STRONG_TOKEN }, method: "GET", url: "/api/feedback" })).statusCode).toBe(200);
    await app.close();
  });
});

describe("AF-05 admin comparison is constant time", () => {
  it("compares equal-length digests rather than raw strings", () => {
    expect(timingSafeEquals(STRONG_TOKEN, STRONG_TOKEN)).toBe(true);
    // A length mismatch must return false, not throw (a throw is itself a leak).
    expect(timingSafeEquals(STRONG_TOKEN, "s")).toBe(false);
    expect(timingSafeEquals("", "")).toBe(true);
    // A one-byte prefix difference must not be distinguishable from a total miss.
    expect(timingSafeEquals(STRONG_TOKEN, `x${STRONG_TOKEN.slice(1)}`)).toBe(false);
  });

  it("only accepts a Bearer scheme it can parse", () => {
    expect(presentedAdminToken({ "x-admin-token": "abc" })).toBe("abc");
    expect(presentedAdminToken({ authorization: "Bearer abc" })).toBe("abc");
    expect(presentedAdminToken({ authorization: "bearer abc" })).toBeNull();
    expect(presentedAdminToken({ authorization: "Basic abc" })).toBeNull();
    expect(presentedAdminToken({})).toBeNull();
  });
});

describe("AF-06 rate limiting", () => {
  it("allows up to max in a window then answers 429 with Retry-After", async () => {
    const app = await buildAutoflexApi({ rateLimit: { max: 3, windowMs: 60_000 } });
    const codes: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      codes.push((await app.inject({ method: "GET", url: "/api/health" })).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 429, 429]);

    const blocked = await app.inject({ method: "GET", url: "/api/health" });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    await app.close();
  });

  it("gives failed admin authentication a much smaller budget than normal traffic", async () => {
    const app = await buildAutoflexApi({
      adminAttemptLimit: { max: 2, windowMs: 60_000 },
      adminToken: STRONG_TOKEN,
      rateLimit: { max: 1000, windowMs: 60_000 },
    });
    const codes: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      codes.push(
        (await app.inject({ headers: { "x-admin-token": `guess-${attempt}` }, method: "GET", url: "/api/feedback" }))
          .statusCode,
      );
    }
    expect(codes).toEqual([401, 401, 429, 429]);
    await app.close();
  });

  it("expires windows and bounds its own key table", () => {
    const limiter = createRateLimiter({ max: 1, maxKeys: 16, windowMs: 1_000 });
    expect(limiter.hit("a", 0).allowed).toBe(true);
    expect(limiter.hit("a", 500).allowed).toBe(false);
    expect(limiter.hit("a", 1_500).allowed).toBe(true);
    for (let index = 0; index < 200; index += 1) limiter.hit(`key-${index}`, 2_000);
    expect(limiter.size()).toBeLessThanOrEqual(200);
  });
});

describe("AF-07 request body limits", () => {
  it("refuses an oversized body with 413 instead of buffering it", async () => {
    const app = await buildAutoflexApi({ bodyLimit: 1024, rateLimit: { max: 0, windowMs: 1 } });
    const response = await app.inject({
      headers: { "content-type": "application/json" },
      method: "POST",
      payload: JSON.stringify({ message: "x".repeat(4096) }),
      url: "/api/feedback",
    });
    expect(response.statusCode).toBe(413);
    await app.close();
  });
});

describe("AF-08 error responses do not echo internals", () => {
  it("returns a stable message for a malformed body", async () => {
    const app = await buildAutoflexApi({ rateLimit: { max: 0, windowMs: 1 } });
    const response = await app.inject({
      headers: { "content-type": "application/json" },
      method: "POST",
      payload: "{ not json",
      url: "/api/feedback",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe(publicErrorMessage(400));
    // No parser internals, byte offsets or Fastify error codes leak to the client.
    expect(JSON.stringify(response.json())).not.toMatch(/JSON|position|FST_|Unexpected/i);
    await app.close();
  });

  it("keeps deliberate validation messages, which are not internals", async () => {
    const app = await buildAutoflexApi({ rateLimit: { max: 0, windowMs: 1 } });
    const response = await app.inject({
      method: "PUT",
      payload: { city: "Pune", displayName: "Tester", garageRole: "Service center" },
      url: "/api/profiles/tester",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("garageRole");
    await app.close();
  });
});

describe("AF-09 CORS is an allow-list, never origin reflection", () => {
  it("never resolves to a wildcard or `true`", () => {
    expect(resolveAllowedOrigins(undefined, undefined)).toEqual([...DEFAULT_DEV_ORIGINS]);
    expect(resolveAllowedOrigins(undefined, "https://a.example, https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
    expect(resolveAllowedOrigins(["https://only.example"], "https://ignored.example")).toEqual([
      "https://only.example",
    ]);
    expect(resolveAllowedOrigins(undefined, undefined)).not.toContain("*");
  });

  it("does not echo an arbitrary Origin back to the browser", async () => {
    const app = await buildAutoflexApi({
      allowedOrigins: ["https://app.example"],
      rateLimit: { max: 0, windowMs: 1 },
    });
    const hostile = await app.inject({
      headers: { origin: "https://attacker.example" },
      method: "GET",
      url: "/api/posts",
    });
    expect(hostile.headers["access-control-allow-origin"]).toBeUndefined();

    const trusted = await app.inject({
      headers: { origin: "https://app.example" },
      method: "GET",
      url: "/api/posts",
    });
    expect(trusted.headers["access-control-allow-origin"]).toBe("https://app.example");
    await app.close();
  });
});

describe("AF-10 baseline response headers", () => {
  it("sets nosniff, framing and cache headers on API responses", async () => {
    const app = await buildAutoflexApi({ rateLimit: { max: 0, windowMs: 1 } });
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(String(response.headers["content-security-policy"])).toContain("frame-ancestors 'none'");
    await app.close();
  });
});

describe("AF-11 create routes copy only declared fields", () => {
  it("drops unknown keys and clamps enums instead of persisting the raw body", async () => {
    const app = await buildAutoflexApi({ rateLimit: { max: 0, windowMs: 1 } });
    const response = await app.inject({
      method: "POST",
      payload: {
        author: "Tester",
        body: "Clutch cable adjusted after 20k km.",
        brand: "Tata",
        city: "Pune",
        fuel: "Plutonium",
        helpful: 999_999,
        isAdmin: true,
        label: "<img src=x onerror=alert(1)>",
        model: "Punch",
        odometerKm: -50,
        title: "Punch clutch note",
        topic: "Repairs",
        userRole: "moderator",
        variant: "Adventure",
      },
      url: "/api/posts",
    });
    const post = response.json();

    expect(response.statusCode).toBe(201);
    // Mass assignment: keys outside DraftPost never reach the store.
    expect(post.isAdmin).toBeUndefined();
    expect(post.userRole).toBeUndefined();
    // Counters stay server-owned.
    expect(post.helpful).toBe(0);
    // Enums are clamped, never echoed.
    expect(post.label).toBe("Owner note");
    expect(post.fuel).toBe("");
    // Numbers are bounded.
    expect(post.odometerKm).toBe(0);

    const listed = (await app.inject({ method: "GET", url: "/api/posts" })).json();
    expect(JSON.stringify(listed)).not.toContain("onerror");
    expect(JSON.stringify(listed)).not.toContain("userRole");
    await app.close();
  });

  it("bounds free-text length so one request cannot bloat the JSON store", async () => {
    const app = await buildAutoflexApi({ rateLimit: { max: 0, windowMs: 1 } });
    const response = await app.inject({
      method: "POST",
      payload: { body: "z".repeat(20_000), model: "Punch", title: "y".repeat(5_000) },
      url: "/api/posts",
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().title.length).toBe(200);
    expect(response.json().body.length).toBe(8_000);
    await app.close();
  });
});
