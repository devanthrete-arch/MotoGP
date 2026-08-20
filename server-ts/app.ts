import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type {
  DraftPost,
  DraftReport,
  DraftShortlistItem,
  DraftTimelineEntry,
  DraftVehicle,
  FollowState,
  KnowledgeLabel,
  Profile,
  ReportRecord,
  ShortlistItem,
  ShortlistStatus,
  TimelineEntryKind,
  VehicleFuel,
  VehicleOwnership,
  VehicleTransmission,
} from "../src/core/entities";
import {
  knowledgeLabels,
  shortlistStatuses,
  timelineKinds,
  vehicleFuels,
  vehicleOwnerships,
  vehicleTransmissions,
} from "../src/core/entities";
import { createPost, createReport, createShortlistItem, createTimelineEntry, createVehicle } from "../src/infrastructure/storage/localStore";
import { createStoreBundle, makeId, type AutoflexStore, type FeedbackRecord, type InspectionSession, type StorePersistence } from "./store";
import {
  createRateLimiter,
  presentedAdminToken,
  publicErrorMessage,
  resolveAdminToken,
  resolveAllowedOrigins,
  timingSafeEquals,
  type RateLimiter,
} from "./security";

type CreateCommentBody = {
  author?: string;
  message?: string;
};

type CreateFeedbackBody = {
  author?: string;
  message?: string;
  surface?: string;
};

type CreateInspectionBody = {
  shortlistItemId?: string;
  notes?: string[];
  completedChecks?: string[];
};

type ApiOptions = {
  adminToken?: string;
  /** Opt-in escape hatch for local dev only (ALLOW_INSECURE_ADMIN_TOKEN=1). */
  allowInsecureAdminToken?: boolean;
  allowedOrigins?: string[];
  /** Max accepted request body in bytes. Default 64 KiB. */
  bodyLimit?: number;
  dataPath?: string;
  logger?: boolean;
  persistence?: StorePersistence;
  /** Per-IP fixed window. `max: 0` disables (tests only). */
  rateLimit?: { max: number; windowMs: number };
  /** Stricter per-IP budget for failed admin authentication. */
  adminAttemptLimit?: { max: number; windowMs: number };
  store?: AutoflexStore;
  version?: string;
};

/** Body bytes we are willing to parse. Fastify's default is 1 MiB. */
export const DEFAULT_BODY_LIMIT = 64 * 1024;
export const DEFAULT_RATE_LIMIT = { max: 120, windowMs: 60_000 };
export const DEFAULT_ADMIN_ATTEMPT_LIMIT = { max: 10, windowMs: 60_000 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const badRequest = (message: string) => ({
  error: "Bad request",
  message,
});

const bodyAsRecord = (body: unknown): Record<string, unknown> => (isRecord(body) ? body : {});

const requiredString = (body: Record<string, unknown>, key: string): string | null => {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const optionalStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim().slice(0, 120))
        .slice(0, 50)
    : [];

const profileRoles: Profile["garageRole"][] = ["Owner", "Buyer", "Enthusiast", "Mechanic"];

/* -------------------------------------------------------------------------- */
/* Draft construction                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Every create route used to hand the raw request body to the domain factory
 * (`createPost(body as DraftPost)`), so any extra key a caller invented was
 * persisted and served back to every other client. These builders copy only the
 * fields the domain type declares, bound their length, and clamp enums.
 */
const boundedString = (value: unknown, max: number, fallback = ""): string => {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
};

const boundedNumber = (value: unknown, min: number, max: number): number => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const optionalOneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | "" =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : "";

const MAX_ODOMETER = 5_000_000;
const MAX_AMOUNT = 100_000_000;

const toPostDraft = (body: Record<string, unknown>): DraftPost => ({
  author: boundedString(body.author, 120, "Anonymous garage member"),
  body: boundedString(body.body, 8_000),
  brand: boundedString(body.brand, 80),
  city: boundedString(body.city, 80),
  fuel: optionalOneOf<VehicleFuel>(body.fuel, vehicleFuels),
  label: oneOf<KnowledgeLabel>(body.label, knowledgeLabels, "Owner note"),
  model: boundedString(body.model, 80),
  odometerKm: boundedNumber(body.odometerKm, 0, MAX_ODOMETER),
  title: boundedString(body.title, 200),
  topic: boundedString(body.topic, 80, "Ownership"),
  variant: boundedString(body.variant, 80),
});

const toVehicleDraft = (body: Record<string, unknown>): DraftVehicle => ({
  brand: boundedString(body.brand, 80),
  city: boundedString(body.city, 80),
  fuel: optionalOneOf<VehicleFuel>(body.fuel, vehicleFuels),
  model: boundedString(body.model, 80),
  nickname: boundedString(body.nickname, 80),
  odometerKm: boundedNumber(body.odometerKm, 0, MAX_ODOMETER),
  ownership: optionalOneOf<VehicleOwnership>(body.ownership, vehicleOwnerships),
  purchaseMonth: boundedString(body.purchaseMonth, 16),
  transmission: optionalOneOf<VehicleTransmission>(body.transmission, vehicleTransmissions),
  variant: boundedString(body.variant, 80),
});

const toTimelineDraft = (body: Record<string, unknown>): DraftTimelineEntry => ({
  amount: boundedNumber(body.amount, 0, MAX_AMOUNT),
  happenedOn: boundedString(body.happenedOn, 32),
  kind: oneOf<TimelineEntryKind>(body.kind, timelineKinds, "Note"),
  note: boundedString(body.note, 2_000),
  odometerKm: boundedNumber(body.odometerKm, 0, MAX_ODOMETER),
  title: boundedString(body.title, 200),
  vehicleId: boundedString(body.vehicleId, 120),
});

const toShortlistDraft = (body: Record<string, unknown>): DraftShortlistItem => ({
  brand: boundedString(body.brand, 80),
  budget: boundedNumber(body.budget, 0, MAX_AMOUNT),
  model: boundedString(body.model, 80),
  notes: boundedString(body.notes, 2_000),
  status: oneOf<ShortlistStatus>(body.status, shortlistStatuses, "Researching"),
});

const toReportDraft = (body: Record<string, unknown>, postTitle: string): DraftReport => ({
  postId: boundedString(body.postId, 120),
  postTitle: boundedString(postTitle, 200, "Untitled note"),
  reason: boundedString(body.reason, 2_000),
  reporterName: boundedString(body.reporterName, 120, "Anonymous reporter"),
});

/**
 * Constant-time admin check.
 *
 * The previous `===` comparison short-circuits on the first differing byte, so
 * response time leaks a prefix oracle over the token. Both accepted headers now
 * funnel into a single digest comparison.
 */
const isAdminRequest = (headers: FastifyRequest["headers"], adminToken: string): boolean => {
  const presented = presentedAdminToken(headers as Record<string, unknown>);
  if (presented === null) return false;
  return timingSafeEquals(presented, adminToken);
};

export async function buildAutoflexApi(options: ApiOptions = {}): Promise<FastifyInstance> {
  const bundle = options.store
    ? {
        persistence: options.persistence ?? {
          persist: async () => undefined,
          storage: "memory" as const,
        },
        store: options.store,
      }
    : await createStoreBundle(options.dataPath ?? process.env.API_DATA_PATH);
  const { persistence, store } = bundle;
  const version = options.version ?? process.env.APP_VERSION ?? "dev";

  /* Admin surface: fail closed -------------------------------------------- */
  const admin = resolveAdminToken(options.adminToken ?? process.env.ADMIN_TOKEN, {
    allowInsecure: options.allowInsecureAdminToken ?? process.env.ALLOW_INSECURE_ADMIN_TOKEN === "1",
  });
  const adminToken = admin.ok ? admin.token : null;

  const bodyLimit =
    options.bodyLimit ?? (Number.parseInt(process.env.BODY_LIMIT_BYTES ?? "", 10) || DEFAULT_BODY_LIMIT);
  const app = Fastify({ bodyLimit, logger: options.logger ?? false });

  const announce = (message: string) => {
    if (process.env.NODE_ENV === "test") return;
    console.warn(message);
  };

  if (!admin.ok) {
    // Visible even with the logger off: a deployment running without a real
    // admin token has no moderation queue, and that must not be a surprise.
    announce(
      `[autoflex-api] ADMIN_TOKEN is ${admin.reason}. Moderation and feedback-list routes are disabled (503). ` +
        `Set a random ADMIN_TOKEN of at least 24 characters, or ALLOW_INSECURE_ADMIN_TOKEN=1 for local development only.`,
    );
  } else if (admin.insecure) {
    announce("[autoflex-api] Running with an INSECURE admin token. Never do this outside local development.");
  }

  /* CORS: explicit allow-list, never origin reflection --------------------- */
  const allowedOrigins = resolveAllowedOrigins(options.allowedOrigins, process.env.CORS_ORIGINS);
  await app.register(cors, {
    credentials: false,
    maxAge: 600,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: allowedOrigins,
  });

  /* Rate limiting ---------------------------------------------------------- */
  const rateLimitConfig = options.rateLimit ?? {
    max: Number.parseInt(process.env.RATE_LIMIT_MAX ?? "", 10) || DEFAULT_RATE_LIMIT.max,
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "", 10) || DEFAULT_RATE_LIMIT.windowMs,
  };
  const adminAttemptConfig = options.adminAttemptLimit ?? DEFAULT_ADMIN_ATTEMPT_LIMIT;
  const limiter: RateLimiter | null =
    rateLimitConfig.max > 0 ? createRateLimiter(rateLimitConfig) : null;
  const adminLimiter: RateLimiter | null =
    adminAttemptConfig.max > 0 ? createRateLimiter(adminAttemptConfig) : null;

  const clientKey = (request: FastifyRequest): string => request.ip || "unknown";

  app.addHook("onRequest", async (request, reply) => {
    // Static, cheap headers on every response including errors. The API can be
    // deployed on its own host where vercel.json does not apply.
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Cross-Origin-Resource-Policy", "same-site");
    reply.header("Cache-Control", "no-store");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

    if (!limiter) return;
    const verdict = limiter.hit(clientKey(request));
    if (verdict.allowed) {
      reply.header("X-RateLimit-Remaining", String(verdict.remaining));
      return;
    }
    reply.header("Retry-After", String(verdict.retryAfterSeconds));
    return reply.code(429).send({ error: "Too many requests", message: publicErrorMessage(429) });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode =
      "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400
        ? error.statusCode
        : 500;
    // Detail stays server-side: parser offsets and payload sizes are a map of
    // the API's internals.
    announce(`[autoflex-api] ${request.method} ${request.url} -> ${statusCode}: ${error.code ?? error.name}`);
    if (statusCode < 500) {
      return reply.code(statusCode).send({ error: "Bad request", message: publicErrorMessage(statusCode) });
    }
    return reply.code(500).send({ error: "Internal server error", message: publicErrorMessage(500) });
  });

  const healthResponse = () => ({
    serviceCenterBoundary: "reserved",
    status: "ok",
    storage: persistence.storage,
    version,
  });

  const persist = async () => {
    await persistence.persist();
  };

  const requireAdmin = (request: FastifyRequest, reply: FastifyReply) => {
    // Fail closed: no usable token means no admin surface at all.
    if (adminToken === null) {
      reply.code(503).send({
        error: "Unavailable",
        message: "Admin routes are disabled because no ADMIN_TOKEN is configured.",
      });
      return false;
    }
    if (isAdminRequest(request.headers, adminToken)) return true;
    if (adminLimiter) {
      // Brute-forcing the token should cost far more than 120 requests/min.
      const verdict = adminLimiter.hit(`admin:${clientKey(request)}`);
      if (!verdict.allowed) {
        reply.header("Retry-After", String(verdict.retryAfterSeconds));
        reply.code(429).send({ error: "Too many requests", message: publicErrorMessage(429) });
        return false;
      }
    }
    reply.code(401).send({ error: "Unauthorized", message: "Admin token is required." });
    return false;
  };

  app.get("/health", async () => healthResponse());
  app.get("/api/health", async () => healthResponse());

  app.get("/api/profiles/:profileId", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };
    const profile = store.profiles.get(profileId);
    if (!profile) return reply.code(404).send({ error: "Profile not found" });
    return { id: profileId, ...profile };
  });

  app.put("/api/profiles/:profileId", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };
    const body = bodyAsRecord(request.body);
    const displayName = requiredString(body, "displayName");
    const city = requiredString(body, "city");
    const garageRole = requiredString(body, "garageRole");
    if (!displayName || !city || !garageRole) {
      return reply.code(400).send(badRequest("displayName, city, and garageRole are required."));
    }
    if (!profileRoles.includes(garageRole as Profile["garageRole"])) {
      return reply.code(400).send(badRequest("garageRole must be Owner, Buyer, Enthusiast, or Mechanic."));
    }

    const profile: Profile = {
      city,
      displayName,
      garageRole: garageRole as Profile["garageRole"],
    };
    store.profiles.set(profileId, profile);
    await persist();
    return { id: profileId, ...profile };
  });

  app.get("/api/posts", async () => ({
    posts: [...store.posts.values()].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
  }));

  app.post("/api/posts", async (request, reply) => {
    const body = bodyAsRecord(request.body);
    const title = requiredString(body, "title");
    const model = requiredString(body, "model");
    const bodyText = requiredString(body, "body");
    if (!title || !model || !bodyText) {
      return reply.code(400).send(badRequest("title, model, and body are required."));
    }

    const post = createPost(toPostDraft(body));
    store.posts.set(post.id, post);
    store.comments.set(post.id, []);
    await persist();
    return reply.code(201).send(post);
  });

  app.get("/api/posts/:postId/comments", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    if (!store.posts.has(postId)) return reply.code(404).send({ error: "Post not found" });
    return { comments: store.comments.get(postId) ?? [] };
  });

  app.post("/api/posts/:postId/comments", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    if (!store.posts.has(postId)) return reply.code(404).send({ error: "Post not found" });

    const body = (request.body ?? {}) as CreateCommentBody;
    const message = body.message?.trim();
    if (!message) return reply.code(400).send(badRequest("message is required."));

    const author = body.author?.trim() || "Anonymous garage member";
    const comment = `${author}: ${message}`;
    const comments = [comment, ...(store.comments.get(postId) ?? [])];
    store.comments.set(postId, comments);

    const post = store.posts.get(postId);
    if (post) store.posts.set(postId, { ...post, comments });
    await persist();
    return reply.code(201).send({ comment, comments });
  });

  app.post("/api/reports", async (request, reply) => {
    const body = bodyAsRecord(request.body);
    const postId = requiredString(body, "postId");
    const reason = requiredString(body, "reason");
    if (!postId || !reason) return reply.code(400).send(badRequest("postId and reason are required."));

    const post = store.posts.get(postId);
    if (!post) return reply.code(404).send({ error: "Post not found" });

    const report = createReport(toReportDraft(body, post.title));
    store.reports.set(report.id, report);
    await persist();
    return reply.code(201).send(report);
  });

  app.get("/api/moderation/reports", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    return {
      reports: [...store.reports.values()].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
    };
  });

  app.patch("/api/moderation/reports/:reportId", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { reportId } = request.params as { reportId: string };
    const report = store.reports.get(reportId);
    if (!report) return reply.code(404).send({ error: "Report not found" });

    const status = requiredString(bodyAsRecord(request.body), "status") as ReportRecord["status"] | null;
    if (!status || !["Open", "Dismissed", "Removed"].includes(status)) {
      return reply.code(400).send(badRequest("status must be Open, Dismissed, or Removed."));
    }

    const nextReport = { ...report, status };
    store.reports.set(reportId, nextReport);
    await persist();
    return nextReport;
  });

  app.get("/api/follows/:profileId", async (request) => {
    const { profileId } = request.params as { profileId: string };
    return store.follows.get(profileId) ?? { models: [], topics: [] };
  });

  app.put("/api/follows/:profileId", async (request) => {
    const { profileId } = request.params as { profileId: string };
    const body = bodyAsRecord(request.body);
    const follows: FollowState = {
      models: optionalStringArray(body.models),
      topics: optionalStringArray(body.topics),
    };
    store.follows.set(profileId, follows);
    await persist();
    return follows;
  });

  app.get("/api/saves/:profileId", async (request) => {
    const { profileId } = request.params as { profileId: string };
    return { postIds: [...(store.saves.get(profileId) ?? new Set<string>())] };
  });

  app.put("/api/saves/:profileId", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };
    const postIds = optionalStringArray(bodyAsRecord(request.body).postIds);
    const unknownPost = postIds.find((postId) => !store.posts.has(postId));
    if (unknownPost) return reply.code(404).send({ error: `Post not found: ${unknownPost}` });

    store.saves.set(profileId, new Set(postIds));
    await persist();
    return { postIds };
  });

  app.get("/api/garage/vehicles", async () => ({
    vehicles: [...store.garage.values()],
  }));

  app.post("/api/garage/vehicles", async (request, reply) => {
    const body = bodyAsRecord(request.body);
    const model = requiredString(body, "model");
    if (!model) return reply.code(400).send(badRequest("model is required."));

    const vehicle = createVehicle(toVehicleDraft(body));
    store.garage.set(vehicle.id, vehicle);
    await persist();
    return reply.code(201).send(vehicle);
  });

  app.get("/api/garage/timeline", async () => ({
    entries: [...store.timeline.values()].sort((first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn)),
  }));

  app.post("/api/garage/timeline", async (request, reply) => {
    const body = bodyAsRecord(request.body);
    const vehicleId = requiredString(body, "vehicleId");
    if (!vehicleId) return reply.code(400).send(badRequest("vehicleId is required."));
    if (!store.garage.has(vehicleId)) return reply.code(404).send({ error: "Vehicle not found" });

    const entry = createTimelineEntry(toTimelineDraft(body));
    store.timeline.set(entry.id, entry);
    await persist();
    return reply.code(201).send(entry);
  });

  app.get("/api/shortlist", async () => ({
    items: [...store.shortlist.values()],
  }));

  app.post("/api/shortlist", async (request, reply) => {
    const body = bodyAsRecord(request.body);
    const model = requiredString(body, "model");
    if (!model) return reply.code(400).send(badRequest("model is required."));

    const item: ShortlistItem = createShortlistItem(toShortlistDraft(body));
    store.shortlist.set(item.id, item);
    await persist();
    return reply.code(201).send(item);
  });

  app.get("/api/inspections", async () => ({
    sessions: [...store.inspections.values()],
  }));

  app.post("/api/inspections", async (request, reply) => {
    const body = (request.body ?? {}) as CreateInspectionBody;
    const shortlistItemId = body.shortlistItemId?.trim();
    if (!shortlistItemId) return reply.code(400).send(badRequest("shortlistItemId is required."));

    const session: InspectionSession = {
      completedChecks: optionalStringArray(body.completedChecks),
      createdAt: new Date().toISOString(),
      id: makeId("inspection", shortlistItemId),
      notes: optionalStringArray(body.notes),
      shortlistItemId,
    };
    store.inspections.set(session.id, session);
    await persist();
    return reply.code(201).send(session);
  });

  app.post("/api/feedback", async (request, reply) => {
    const body = (request.body ?? {}) as CreateFeedbackBody;
    const message = body.message?.trim();
    if (!message) return reply.code(400).send(badRequest("message is required."));

    const feedback: FeedbackRecord = {
      author: body.author?.trim() || "Anonymous tester",
      createdAt: new Date().toISOString(),
      id: makeId("feedback", body.surface ?? "general"),
      message,
      surface: body.surface?.trim() || "general",
    };
    store.feedback.set(feedback.id, feedback);
    await persist();
    return reply.code(201).send(feedback);
  });

  app.get("/api/feedback", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    return {
      feedback: [...store.feedback.values()].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
    };
  });

  app.all("/api/service-centers/*", async (_request, reply) =>
    reply.code(404).send({
      error: "Service-center integration is not part of this API yet.",
      owner: "Separate service-center team",
    }),
  );

  return app;
}
