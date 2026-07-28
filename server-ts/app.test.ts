import { describe, expect, it } from "vitest";
import { buildAutoflexApi } from "./app";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Autoflex Fastify API foundation", () => {
  it("exposes health without claiming service-center ownership", async () => {
    const app = await buildAutoflexApi();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      serviceCenterBoundary: "reserved",
      status: "ok",
      storage: "memory",
      version: "dev",
    });

    const apiResponse = await app.inject({ method: "GET", url: "/api/health" });
    expect(apiResponse.statusCode).toBe(200);
    expect(apiResponse.json()).toMatchObject({ status: "ok" });

    await app.close();
  });

  it("creates posts and comments through hosted API contracts", async () => {
    const app = await buildAutoflexApi();
    const postResponse = await app.inject({
      method: "POST",
      payload: {
        author: "Priyansh",
        body: "Brake pads squealed after monsoon drives. Cleaning helped before replacement.",
        brand: "Honda",
        city: "Delhi",
        label: "Fix",
        model: "City",
        odometerKm: 31000,
        title: "City brake squeal after monsoon drives",
        topic: "Repairs",
        variant: "ZX CVT",
      },
      url: "/api/posts",
    });
    const post = postResponse.json();

    expect(postResponse.statusCode).toBe(201);
    expect(post.title).toBe("City brake squeal after monsoon drives");

    const commentResponse = await app.inject({
      method: "POST",
      payload: {
        author: "A buyer",
        message: "This is exactly the kind of note I need before inspection.",
      },
      url: `/api/posts/${post.id}/comments`,
    });

    expect(commentResponse.statusCode).toBe(201);
    expect(commentResponse.json().comments[0]).toContain("A buyer:");

    await app.close();
  });

  it("rejects profile roles outside the hosted profile contract", async () => {
    const app = await buildAutoflexApi();
    const response = await app.inject({
      method: "PUT",
      payload: {
        city: "Pune",
        displayName: "Launch tester",
        garageRole: "Service center",
      },
      url: "/api/profiles/tester",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("garageRole");

    await app.close();
  });

  it("keeps moderation, follows, saves, garage, shortlist, inspections, and feedback addressable", async () => {
    const app = await buildAutoflexApi();

    const follows = await app.inject({
      method: "PUT",
      payload: { models: ["tata-nexon"], topics: ["Fix"] },
      url: "/api/follows/demo",
    });
    expect(follows.statusCode).toBe(200);
    expect(follows.json()).toEqual({ models: ["tata-nexon"], topics: ["Fix"] });

    const saves = await app.inject({
      method: "PUT",
      payload: { postIds: ["nexon-diesel-clutch"] },
      url: "/api/saves/demo",
    });
    expect(saves.statusCode).toBe(200);
    expect(saves.json()).toEqual({ postIds: ["nexon-diesel-clutch"] });

    const vehicleResponse = await app.inject({
      method: "POST",
      payload: {
        brand: "Kia",
        city: "Gurugram",
        model: "Seltos",
        nickname: "Family car",
        odometerKm: 18000,
        purchaseMonth: "2025-02",
        variant: "HTX",
      },
      url: "/api/garage/vehicles",
    });
    const vehicle = vehicleResponse.json();
    expect(vehicleResponse.statusCode).toBe(201);

    const timelineResponse = await app.inject({
      method: "POST",
      payload: {
        amount: 6400,
        happenedOn: "2026-07-20",
        kind: "Service",
        note: "Annual service with alignment.",
        odometerKm: 18000,
        title: "Annual service",
        vehicleId: vehicle.id,
      },
      url: "/api/garage/timeline",
    });
    expect(timelineResponse.statusCode).toBe(201);

    const shortlistResponse = await app.inject({
      method: "POST",
      payload: {
        brand: "Toyota",
        budget: 1800000,
        model: "Hyryder",
        notes: "Compare hybrid running cost against City e:HEV.",
        status: "Researching",
      },
      url: "/api/shortlist",
    });
    const shortlistItem = shortlistResponse.json();
    expect(shortlistResponse.statusCode).toBe(201);

    const inspectionResponse = await app.inject({
      method: "POST",
      payload: {
        completedChecks: ["service history", "tyres"],
        notes: ["Ask about hybrid battery warranty."],
        shortlistItemId: shortlistItem.id,
      },
      url: "/api/inspections",
    });
    expect(inspectionResponse.statusCode).toBe(201);

    const reportResponse = await app.inject({
      method: "POST",
      payload: {
        postId: "nexon-diesel-clutch",
        reason: "Needs bill proof before surfacing as verified.",
        reporterName: "Moderator",
      },
      url: "/api/reports",
    });
    const report = reportResponse.json();
    expect(reportResponse.statusCode).toBe(201);

    const blockedModerationResponse = await app.inject({
      method: "PATCH",
      payload: { status: "Dismissed" },
      url: `/api/moderation/reports/${report.id}`,
    });
    expect(blockedModerationResponse.statusCode).toBe(401);

    const moderationResponse = await app.inject({
      headers: { "x-admin-token": "dev-admin" },
      method: "PATCH",
      payload: { status: "Dismissed" },
      url: `/api/moderation/reports/${report.id}`,
    });
    expect(moderationResponse.statusCode).toBe(200);
    expect(moderationResponse.json().status).toBe("Dismissed");

    const feedbackResponse = await app.inject({
      method: "POST",
      payload: {
        author: "Tester",
        message: "Shortlist flow needs a clearer next action.",
        surface: "shortlist",
      },
      url: "/api/feedback",
    });
    expect(feedbackResponse.statusCode).toBe(201);

    const feedbackListResponse = await app.inject({
      headers: { authorization: "Bearer dev-admin" },
      method: "GET",
      url: "/api/feedback",
    });
    expect(feedbackListResponse.statusCode).toBe(200);
    expect(feedbackListResponse.json().feedback[0].surface).toBe("shortlist");

    await app.close();
  });

  it("persists hosted API data when API_DATA_PATH is configured", async () => {
    const dataPath = join(await mkdtemp(join(tmpdir(), "autoflex-api-")), "store.json");
    const firstApp = await buildAutoflexApi({ dataPath });
    const createResponse = await firstApp.inject({
      method: "POST",
      payload: {
        author: "Owner",
        body: "The clutch pedal felt notchy until the cable was adjusted.",
        brand: "Tata",
        city: "Pune",
        label: "Fix",
        model: "Punch",
        odometerKm: 22000,
        title: "Punch clutch cable adjustment note",
        topic: "Repairs",
        variant: "Adventure",
      },
      url: "/api/posts",
    });
    const created = createResponse.json();
    await firstApp.close();

    const secondApp = await buildAutoflexApi({ dataPath });
    const postsResponse = await secondApp.inject({ method: "GET", url: "/api/posts" });

    expect(postsResponse.statusCode).toBe(200);
    expect(postsResponse.json().posts.some((post: { id: string }) => post.id === created.id)).toBe(true);
    expect((await secondApp.inject({ method: "GET", url: "/api/health" })).json().storage).toBe("file");

    await secondApp.close();
  });

  it("does not expose service-center routes before that contract exists", async () => {
    const app = await buildAutoflexApi();
    const response = await app.inject({ method: "GET", url: "/api/service-centers/search" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      owner: "Separate service-center team",
    });

    await app.close();
  });
});
