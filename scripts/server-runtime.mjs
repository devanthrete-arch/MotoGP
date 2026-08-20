/**
 * Production entrypoint for the Fastify API container.
 *
 * `server-ts/index.ts` is the developer entrypoint: it builds the app, listens,
 * and stops there. A container needs three more things, and they are added here
 * rather than in server-ts/ so the API surface owned by the backend team stays
 * untouched:
 *
 *   1. Structured logs. The app is built with `logger: false`, so nothing is
 *      emitted today - a 500 in production leaves no trace. These hooks write
 *      one JSON object per line to stdout, which is what every log drain
 *      (Vercel, Datadog, Loki, CloudWatch) expects.
 *   2. Graceful shutdown. Docker/Kubernetes send SIGTERM; without a handler the
 *      process dies instantly and in-flight writes to API_DATA_PATH are lost
 *      mid-rename.
 *   3. Crash visibility. An unhandled rejection should log once, in the same
 *      format, and exit non-zero so the supervisor restarts it.
 *
 * PRIVACY - this app stores vehicle documents and owner notes. What is logged
 * here is deliberately minimal:
 *   * the ROUTE PATTERN (`/api/profiles/:profileId`), never the resolved URL,
 *     because path params are user and post identifiers;
 *   * never the query string, request body, response body, headers, cookies,
 *     admin token, or client IP.
 * See docs/DEPLOYMENT.md "What must never be logged".
 *
 * Run locally:  npx tsx scripts/server-runtime.mjs
 * In the image: node server/index.mjs   (bundled by esbuild in the Dockerfile)
 */

import { buildAutoflexApi } from "../server-ts/app";

const SERVICE = "autoflex-api";
const VERSION = process.env.APP_VERSION ?? "dev";
const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const SHUTDOWN_GRACE_MS = Number.parseInt(process.env.SHUTDOWN_GRACE_MS ?? "10000", 10);

/** One JSON object per line. No interpolation, so a log drain can index fields. */
const emit = (level, message, fields = {}) => {
  const line = {
    level,
    msg: message,
    service: SERVICE,
    ts: new Date().toISOString(),
    version: VERSION,
    ...fields,
  };
  const stream = level === "error" || level === "fatal" ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(line)}\n`);
};

/**
 * Route pattern, never the resolved path. Fastify 5 exposes the registered
 * pattern on `routeOptions.url`; an unmatched request has none, and reporting
 * the raw URL there would leak whatever a scanner probed us with.
 */
const routeOf = (request) => request.routeOptions?.url ?? "unmatched";

const app = await buildAutoflexApi();

app.addHook("onRequest", (request, _reply, done) => {
  request.autoflexStartedAt = process.hrtime.bigint();
  done();
});

app.addHook("onResponse", (request, reply, done) => {
  const started = request.autoflexStartedAt;
  const durationMs = started ? Number(process.hrtime.bigint() - started) / 1e6 : null;
  emit(reply.statusCode >= 500 ? "error" : "info", "request", {
    // Fastify's per-request id: correlates this line with any error line below.
    durationMs: durationMs === null ? null : Math.round(durationMs * 100) / 100,
    method: request.method,
    requestId: request.id,
    route: routeOf(request),
    status: reply.statusCode,
  });
  done();
});

app.addHook("onError", (request, _reply, error, done) => {
  emit("error", "request_failed", {
    // Message only. Never the body, params or headers that produced it.
    errorMessage: error?.message ?? "unknown error",
    errorName: error?.name ?? "Error",
    method: request.method,
    requestId: request.id,
    route: routeOf(request),
  });
  done();
});

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  emit("info", "shutdown_started", { signal });

  // Hard deadline: if a request hangs, still exit before the orchestrator's
  // SIGKILL so the exit is logged and attributable.
  const forceExit = setTimeout(() => {
    emit("fatal", "shutdown_timeout", { graceMs: SHUTDOWN_GRACE_MS, signal });
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);

  try {
    await app.close();
    clearTimeout(forceExit);
    emit("info", "shutdown_complete", { signal });
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExit);
    emit("fatal", "shutdown_failed", { errorMessage: error?.message ?? "unknown error", signal });
    process.exit(1);
  }
};

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

process.on("unhandledRejection", (reason) => {
  emit("fatal", "unhandled_rejection", {
    errorMessage: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  emit("fatal", "uncaught_exception", { errorMessage: error?.message ?? "unknown error" });
  process.exit(1);
});

try {
  await app.listen({ host: HOST, port: PORT });
  emit("info", "listening", { host: HOST, port: PORT });
} catch (error) {
  emit("fatal", "listen_failed", { errorMessage: error?.message ?? "unknown error", host: HOST, port: PORT });
  process.exit(1);
}
