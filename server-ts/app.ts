import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type {
  DraftPost,
  DraftReport,
  DraftShortlistItem,
  DraftTimelineEntry,
  DraftVehicle,
  FollowState,
  Profile,
  ReportRecord,
  ShortlistItem,
} from "../src/domain";
import { createPost, createReport, createShortlistItem, createTimelineEntry, createVehicle } from "../src/storage";
import { createStoreBundle, makeId, type AutoflexStore, type FeedbackRecord, type InspectionSession, type StorePersistence } from "./store";

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
  allowedOrigins?: string[];
  dataPath?: string;
  persistence?: StorePersistence;
  store?: AutoflexStore;
  version?: string;
};

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

const isAdminRequest = (headers: FastifyRequest["headers"], adminToken: string): boolean => {
  const token = headers["x-admin-token"];
  const authorization = headers.authorization;
  return token === adminToken || authorization === `Bearer ${adminToken}`;
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
  const adminToken = options.adminToken ?? process.env.ADMIN_TOKEN ?? "dev-admin";
  const version = options.version ?? process.env.APP_VERSION ?? "dev";
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: options.allowedOrigins ?? process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? true,
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if ("statusCode" in error && typeof error.statusCode === "number" && error.statusCode < 500) {
      return reply.code(error.statusCode).send(badRequest(error.message));
    }
    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error", message: "Request failed." });
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
    if (isAdminRequest(request.headers, adminToken)) return true;
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

    const post = createPost(body as DraftPost);
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

    const report = createReport({
      ...(body as DraftReport),
      postTitle: post.title,
      reporterName: requiredString(body, "reporterName") ?? "Anonymous reporter",
    });
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

    const vehicle = createVehicle(body as DraftVehicle);
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

    const entry = createTimelineEntry(body as DraftTimelineEntry);
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

    const item: ShortlistItem = createShortlistItem(body as DraftShortlistItem);
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
