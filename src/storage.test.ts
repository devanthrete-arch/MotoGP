import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackNote } from "./domain";
import { seedGarage, seedPosts, seedTimeline } from "./domain";
import {
  createTesterRun,
  loadGarage,
  loadPosts,
  loadProfile,
  loadTimeline,
  normalizeFeedbackNotes,
  parseOtofolksBackup,
  readStoredJson,
  safeJsonParse,
  saveGarage,
  saveProfile,
  saveTimeline,
  setStorageUser,
  type StorageLike,
  updateFeedbackLoopStage,
  updateFeedbackStatus,
  writeStoredJson,
} from "./storage";

describe("account-scoped browser storage", () => {
  let values: Map<string, string>;
  let storage: StorageLike;

  beforeEach(() => {
    setStorageUser(null);
    values = new Map();
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    };
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    setStorageUser(null);
    vi.unstubAllGlobals();
  });

  it.each([
    "posts", "saved", "feedback", "follows", "garage", "vehicle-plates", "timeline", "subscription",
    "profile", "reports", "shortlist", "qa-session", "responsive-qa",
    "production-launch", "production-url", "tester-runs", "production-ops",
  ])("isolates %s across accounts and the legacy namespace", (name) => {
    const key = `autoflex.web.${name}.v1`;
    writeStoredJson(key, "legacy");
    setStorageUser("user:a");
    expect(readStoredJson(key, "empty")).toBe("empty");
    writeStoredJson(key, "account-a");
    setStorageUser("user%3Aa");
    expect(readStoredJson(key, "empty")).toBe("empty");
    writeStoredJson(key, "account-b");
    setStorageUser("user:a");
    expect(readStoredJson(key, "empty")).toBe("account-a");
    setStorageUser("user%3Aa");
    expect(readStoredJson(key, "empty")).toBe("account-b");
    setStorageUser(null);
    expect(readStoredJson(key, "empty")).toBe("legacy");
  });

  it("does not import legacy private records into a signed-in account", () => {
    const profile = { displayName: "Legacy owner", city: "Pune", garageRole: "Owner" as const };
    saveProfile(profile);
    saveGarage(seedGarage);
    saveTimeline(seedTimeline);
    setStorageUser("new-user");
    expect(loadProfile().displayName).toBe("");
    expect(loadGarage()).toEqual([]);
    expect(loadTimeline()).toEqual([]);
    setStorageUser(null);
    expect(loadProfile()).toEqual(profile);
    expect(loadGarage()).toEqual(seedGarage);
    expect(loadTimeline()).toHaveLength(seedTimeline.length);
  });

  it("starts scoped garages and timelines empty but keeps example posts", () => {
    setStorageUser("account-a");
    expect(loadGarage()).toEqual([]);
    expect(loadTimeline()).toEqual([]);
    expect(loadPosts()).toHaveLength(seedPosts.length);
    saveGarage(seedGarage);
    saveTimeline(seedTimeline);
    setStorageUser("account-b");
    expect(loadGarage()).toEqual([]);
    expect(loadTimeline()).toEqual([]);
    setStorageUser("account-a");
    expect(loadGarage()).toEqual(seedGarage);
    expect(loadTimeline()).toHaveLength(seedTimeline.length);
    setStorageUser(null);
    expect(loadGarage()).toEqual(seedGarage);
    expect(loadTimeline()).toHaveLength(seedTimeline.length);
  });

  it("keeps explicitly supplied adapters unscoped", () => {
    setStorageUser("account-a");
    writeStoredJson("fixture", "explicit", storage);
    expect(values.get("fixture")).toBe(JSON.stringify("explicit"));
    expect(readStoredJson("fixture", "empty", storage)).toBe("explicit");
    expect(readStoredJson("fixture", "empty")).toBe("empty");
    expect(readStoredJson("fixture", "empty", null)).toBe("empty");
    writeStoredJson("disabled", "ignored", null);
    expect(values.has("disabled")).toBe(false);
  });
});

describe("Otofolks storage safety", () => {
  it("falls back when stored JSON is missing or corrupt", () => {
    expect(safeJsonParse(null, ["fallback"])).toEqual(["fallback"]);
    expect(safeJsonParse("{not-json", { ready: false })).toEqual({ ready: false });
  });

  it("reads stored JSON through a safe adapter", () => {
    const storage: StorageLike = {
      getItem: () => JSON.stringify({ displayName: "GarageNomad" }),
      setItem: () => undefined,
    };

    expect(readStoredJson("profile", { displayName: "" }, storage)).toEqual({ displayName: "GarageNomad" });
  });

  it("does not crash when browser storage throws", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };

    expect(readStoredJson("profile", { displayName: "" }, storage)).toEqual({ displayName: "" });
    expect(() => writeStoredJson("profile", { displayName: "Owner" }, storage)).not.toThrow();
  });

  it("persists checked QA session ids through the storage adapter", () => {
    let stored = "";
    const storage: StorageLike = {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    };

    writeStoredJson("autoflex.web.qa-session.v1", ["feed", "offline"], storage);
    expect(readStoredJson<string[]>("autoflex.web.qa-session.v1", [], storage)).toEqual(["feed", "offline"]);
  });

  it("persists responsive QA check ids through the storage adapter", () => {
    let stored = "";
    const storage: StorageLike = {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    };

    writeStoredJson("autoflex.web.responsive-qa.v1", ["phone-nav-feed", "desktop-data-tools"], storage);
    expect(readStoredJson<string[]>("autoflex.web.responsive-qa.v1", [], storage)).toEqual([
      "phone-nav-feed",
      "desktop-data-tools",
    ]);
  });

  it("persists production launch checks and URL through the storage adapter", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? "",
      setItem: (key, value) => {
        values.set(key, value);
      },
    };

    writeStoredJson("autoflex.web.production-launch.v1", ["production-url", "security-headers"], storage);
    writeStoredJson("autoflex.web.production-url.v1", "https://otofolks.example.vercel.app", storage);

    expect(readStoredJson<string[]>("autoflex.web.production-launch.v1", [], storage)).toEqual([
      "production-url",
      "security-headers",
    ]);
    expect(readStoredJson<string>("autoflex.web.production-url.v1", "", storage)).toBe("https://otofolks.example.vercel.app");
  });

  it("migrates old feedback notes into the triage lane", () => {
    const notes = normalizeFeedbackNotes([
      {
        createdAt: "2026-07-21T10:00:00.000Z",
        id: "feedback-old",
        message: "Need clearer garage export copy.",
      },
    ]);

    expect(notes[0]).toMatchObject({
      id: "feedback-old",
      loopStage: "Real user",
      status: "New",
    });
  });

  it("updates feedback status without mutating other notes", () => {
    const feedback: FeedbackNote[] = [
      {
        createdAt: "2026-07-21T10:00:00.000Z",
        id: "feedback-one",
        loopStage: "Real user",
        message: "Add city follow.",
        status: "New",
      },
      {
        createdAt: "2026-07-21T11:00:00.000Z",
        id: "feedback-two",
        loopStage: "Designer",
        message: "Keep this untouched.",
        status: "Reviewing",
      },
    ];

    expect(updateFeedbackStatus(feedback, "feedback-one", "Planned")).toEqual([
      { ...feedback[0], status: "Planned" },
      feedback[1],
    ]);
  });

  it("routes feedback through the product loop without mutating other notes", () => {
    const feedback: FeedbackNote[] = [
      {
        createdAt: "2026-07-21T10:00:00.000Z",
        id: "feedback-one",
        loopStage: "Real user",
        message: "The hero copy feels unclear.",
        status: "New",
      },
      {
        createdAt: "2026-07-21T11:00:00.000Z",
        id: "feedback-two",
        loopStage: "Frontend engineer",
        message: "Keep this untouched.",
        status: "Reviewing",
      },
    ];

    expect(updateFeedbackLoopStage(feedback, "feedback-one", "Designer")).toEqual([
      { ...feedback[0], loopStage: "Designer" },
      feedback[1],
    ]);
  });

  it("rejects invalid backup payloads", () => {
    expect(parseOtofolksBackup("{not-json")).toBeNull();
    expect(parseOtofolksBackup(JSON.stringify({ version: 2, data: {} }))).toBeNull();
  });

  it("creates tester runs with a generated id and timestamp", () => {
    const run = createTesterRun({
      friction: "Install prompt was unclear.",
      nextLoopStage: "Designer",
      outcome: "Confusing",
      scenario: "Fresh tester installs the app.",
      testerName: "Riya",
    });

    expect(run.id).toContain("tester-run-");
    expect(run.createdAt).toBeTruthy();
    expect(run.nextLoopStage).toBe("Designer");
  });

  it("parses a valid backup and migrates feedback status", () => {
    const backup = parseOtofolksBackup(
      JSON.stringify({
        data: {
          feedback: [
            {
              createdAt: "2026-07-21T10:00:00.000Z",
              id: "feedback-old",
              message: "Carry my garage to another browser.",
            },
          ],
          follows: { models: ["tata-nexon"], topics: [] },
          garage: [],
          posts: [],
          profile: { city: "Pune", displayName: "Owner", garageRole: "Owner" },
          productionLaunch: ["production-url", 42],
          productionOps: ["https-only", 42],
          productionUrl: "https://otofolks.example.vercel.app",
          reports: [],
          responsiveQa: ["phone-nav-feed", 42],
          saved: ["nexon-diesel-clutch", 42],
          shortlist: [],
          subscriptionSettings: { browserAlerts: false, emailDigest: true, quietHours: true },
          testerRuns: [
            {
              createdAt: "2026-07-22T09:00:00.000Z",
              friction: "Could not find backup export.",
              id: "run-one",
              nextLoopStage: "Frontend engineer",
              outcome: "Blocked",
              scenario: "Tester tries data portability.",
              testerName: "Owner",
            },
          ],
          timeline: [],
        },
        exportedAt: "2026-07-22T10:00:00.000Z",
        version: 1,
      }),
    );

    expect(backup?.data.feedback[0]?.status).toBe("New");
    expect(backup?.data.feedback[0]?.loopStage).toBe("Real user");
    expect(backup?.data.productionLaunch).toEqual(["production-url"]);
    expect(backup?.data.productionOps).toEqual(["https-only"]);
    expect(backup?.data.productionUrl).toBe("https://otofolks.example.vercel.app");
    expect(backup?.data.responsiveQa).toEqual(["phone-nav-feed"]);
    expect(backup?.data.saved).toEqual(["nexon-diesel-clutch"]);
    expect(backup?.data.testerRuns[0]?.outcome).toBe("Blocked");
    expect(backup?.data.profile.displayName).toBe("Owner");
  });
});
