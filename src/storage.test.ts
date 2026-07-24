import { describe, expect, it } from "vitest";
import type { FeedbackNote } from "./domain";
import {
  normalizeFeedbackNotes,
  parseAutoflexBackup,
  readStoredJson,
  safeJsonParse,
  type StorageLike,
  updateFeedbackStatus,
  writeStoredJson,
} from "./storage";

describe("Autoflex storage safety", () => {
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
      status: "New",
    });
  });

  it("updates feedback status without mutating other notes", () => {
    const feedback: FeedbackNote[] = [
      {
        createdAt: "2026-07-21T10:00:00.000Z",
        id: "feedback-one",
        message: "Add city follow.",
        status: "New",
      },
      {
        createdAt: "2026-07-21T11:00:00.000Z",
        id: "feedback-two",
        message: "Keep this untouched.",
        status: "Reviewing",
      },
    ];

    expect(updateFeedbackStatus(feedback, "feedback-one", "Planned")).toEqual([
      { ...feedback[0], status: "Planned" },
      feedback[1],
    ]);
  });

  it("rejects invalid backup payloads", () => {
    expect(parseAutoflexBackup("{not-json")).toBeNull();
    expect(parseAutoflexBackup(JSON.stringify({ version: 2, data: {} }))).toBeNull();
  });

  it("parses a valid backup and migrates feedback status", () => {
    const backup = parseAutoflexBackup(
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
          reports: [],
          saved: ["nexon-diesel-clutch", 42],
          shortlist: [],
          subscriptionSettings: { browserAlerts: false, emailDigest: true, quietHours: true },
          timeline: [],
        },
        exportedAt: "2026-07-22T10:00:00.000Z",
        version: 1,
      }),
    );

    expect(backup?.data.feedback[0]?.status).toBe("New");
    expect(backup?.data.saved).toEqual(["nexon-diesel-clutch"]);
    expect(backup?.data.profile.displayName).toBe("Owner");
  });
});
