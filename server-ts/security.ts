/**
 * Security primitives for the hosted Fastify API.
 *
 * Everything here is dependency-free on purpose: the API ships in a small
 * container and a security control that needs a network install is a security
 * control that gets skipped.
 */
import { createHash, timingSafeEqual } from "node:crypto";

/* -------------------------------------------------------------------------- */
/* Admin token                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Tokens that appear in this repository, its docs, and every tutorial that
 * copied them. Treating them as "configured" is how a staging box becomes an
 * open moderation console.
 */
export const WEAK_ADMIN_TOKENS: readonly string[] = [
  "dev-admin",
  "change-me",
  "changeme",
  "admin",
  "password",
  "secret",
  "token",
  "test",
];

/** Shortest token we accept. 24 chars of base64url is ~144 bits. */
export const MIN_ADMIN_TOKEN_LENGTH = 24;

export type AdminTokenResolution =
  | { ok: true; token: string; insecure: boolean }
  | { ok: false; reason: "missing" | "weak" | "short" };

/**
 * Fail closed. A missing, defaulted or short token disables the admin surface
 * entirely rather than silently protecting it with a value the whole internet
 * already knows.
 *
 * `allowInsecure` (ALLOW_INSECURE_ADMIN_TOKEN=1) is the deliberate local-dev
 * escape hatch: it must be set on purpose, and it is reported back so the
 * caller can log a warning.
 */
export const resolveAdminToken = (
  rawToken: string | undefined | null,
  options: { allowInsecure?: boolean } = {},
): AdminTokenResolution => {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const allowInsecure = options.allowInsecure === true;

  if (!token) return allowInsecure ? { insecure: true, ok: true, token: "dev-admin" } : { ok: false, reason: "missing" };
  if (WEAK_ADMIN_TOKENS.includes(token.toLowerCase())) {
    return allowInsecure ? { insecure: true, ok: true, token } : { ok: false, reason: "weak" };
  }
  if (token.length < MIN_ADMIN_TOKEN_LENGTH) {
    return allowInsecure ? { insecure: true, ok: true, token } : { ok: false, reason: "short" };
  }
  return { insecure: false, ok: true, token };
};

/**
 * Constant-time string comparison.
 *
 * Both sides are hashed first so `timingSafeEqual` always sees equal-length
 * buffers: comparing raw strings throws on a length mismatch, and catching that
 * throw leaks the token length through timing anyway.
 */
export const timingSafeEquals = (left: string, right: string): boolean => {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
};

/** Extract the presented admin credential from either accepted header. */
export const presentedAdminToken = (headers: Record<string, unknown>): string | null => {
  const direct = headers["x-admin-token"];
  if (typeof direct === "string" && direct) return direct;
  const authorization = headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const value = authorization.slice("Bearer ".length);
    return value || null;
  }
  return null;
};

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

export type RateLimitVerdict = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  hit: (key: string, now?: number) => RateLimitVerdict;
  reset: () => void;
  size: () => number;
};

/**
 * Fixed-window in-process limiter.
 *
 * Deliberately simple: this API is single-process behind one container. A
 * shared-state limiter (Redis) is the right answer once it is replicated, and
 * that is recorded as residual risk in docs/SECURITY_AUDIT.md.
 */
export const createRateLimiter = (options: { max: number; windowMs: number; maxKeys?: number }): RateLimiter => {
  const max = Math.max(1, Math.floor(options.max));
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const maxKeys = Math.max(16, Math.floor(options.maxKeys ?? 10_000));
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const sweep = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  return {
    hit: (key, now = Date.now()) => {
      // Unbounded key growth is itself a denial-of-service vector.
      if (buckets.size > maxKeys) sweep(now);
      if (buckets.size > maxKeys) buckets.clear();

      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
      }
      bucket.count += 1;
      if (bucket.count > max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
      }
      return { allowed: true, remaining: max - bucket.count, retryAfterSeconds: 0 };
    },
    reset: () => buckets.clear(),
    size: () => buckets.size,
  };
};

/* -------------------------------------------------------------------------- */
/* CORS                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Local development origins. `origin: true` reflects *any* Origin, which lets
 * any page on the internet read every unauthenticated route on a developer's
 * machine (or on a staging box) via the victim's browser.
 */
export const DEFAULT_DEV_ORIGINS: readonly string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/** Parse CORS_ORIGINS into an explicit allow-list. Never returns `true`. */
export const resolveAllowedOrigins = (
  configured: string[] | undefined,
  rawEnv: string | undefined,
): string[] => {
  if (configured && configured.length) return [...configured];
  const fromEnv = (rawEnv ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return [...DEFAULT_DEV_ORIGINS];
};

/* -------------------------------------------------------------------------- */
/* Error sanitisation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Framework errors (JSON parse failures, payload-too-large, unsupported media
 * type) carry parser internals and byte offsets. Clients get the status and a
 * stable code; the detail stays in the server log.
 */
export const publicErrorMessage = (statusCode: number): string => {
  if (statusCode === 400) return "The request body could not be read.";
  if (statusCode === 401) return "Authentication is required.";
  if (statusCode === 403) return "Not allowed.";
  if (statusCode === 404) return "Not found.";
  if (statusCode === 405) return "Method not allowed.";
  if (statusCode === 413) return "The request body is too large.";
  if (statusCode === 415) return "Unsupported content type.";
  if (statusCode === 429) return "Too many requests.";
  return "Request failed.";
};
