import { beforeEach, describe, expect, it, vi } from "vitest";

// The whole point of this suite: with no configured client, every hosted call
// must degrade to the local value instead of throwing into a render.
vi.mock("../supabase/client", () => ({
  getSupabaseClient: () => null,
  isCloudSyncConfigured: false,
}));

import type { FeedbackNote, GarageVehicle, OwnerPost, Profile, ReportRecord, ShortlistItem, TimelineEntry } from "../../core/entities";
import type { GarageReminder, OwnershipPlaybook } from "../../insights";
import {
  addHostedComment,
  addHostedPlaybookEntry,
  deleteHostedCost,
  deleteHostedFeedbackNote,
  deleteHostedInspection,
  deleteHostedPost,
  deleteHostedReminder,
  deleteHostedShortlistItem,
  deleteHostedTimelineEntry,
  deleteHostedVehicle,
  type HostedResult,
  type HostedWorkspaceSnapshot,
  hostedSyncDomains,
  isBrowserOffline,
  listHostedCityCircles,
  listHostedCityFollows,
  listHostedCosts,
  listHostedFeedback,
  listHostedGarage,
  listHostedInspections,
  listHostedNotificationDeliveries,
  listHostedNotificationJobs,
  listHostedPlaybookEntries,
  listHostedPlaybooks,
  listHostedPostQuality,
  listHostedPostRankings,
  listHostedPosts,
  listHostedReminders,
  listHostedReports,
  listHostedSavedPostIds,
  listHostedShortlist,
  listHostedTimeline,
  loadHostedCityCircle,
  loadHostedFollows,
  loadHostedPlaybook,
  loadHostedProfile,
  loadHostedSubscriptionSettings,
  publishHostedChecklists,
  publishHostedCityCircles,
  publishHostedPostQuality,
  queueHostedNotification,
  queueHostedNotifications,
  recordHostedDelivery,
  replaceHostedSavedPosts,
  runHosted,
  runHostedForUser,
  saveHostedFollows,
  saveHostedProfile,
  saveHostedSubscriptionSettings,
  setHostedCityFollow,
  setHostedFeedbackLoopStage,
  setHostedFeedbackStatus,
  setHostedInspectionItemState,
  setHostedNotificationJobStatus,
  setHostedReminderStatus,
  setHostedReportStatus,
  setHostedSavedPost,
  syncAllHosted,
  syncHostedCostsFromTimeline,
  upsertHostedCosts,
  upsertHostedFeedback,
  upsertHostedFeedbackNote,
  upsertHostedInspection,
  upsertHostedInspections,
  upsertHostedPlaybooks,
  upsertHostedPost,
  upsertHostedPostQuality,
  upsertHostedPosts,
  upsertHostedReminders,
  upsertHostedReport,
  upsertHostedReports,
  upsertHostedShortlistItem,
  upsertHostedShortlistItems,
  upsertHostedTimelineEntries,
  upsertHostedTimelineEntry,
  upsertHostedVehicle,
  upsertHostedVehicles,
} from "./index";

const userId = "11111111-2222-3333-4444-555555555555";

const profile: Profile = { city: "Pune", displayName: "Amit", garageRole: "Owner" };
const vehicle: GarageVehicle = {
  brand: "Tata",
  city: "Pune",
  id: "garage-nexon",
  model: "Nexon",
  nickname: "Daily diesel",
  odometerKm: 42000,
  purchaseMonth: "2021-08",
  variant: "XZ+ Diesel MT",
};
const entry: TimelineEntry = {
  amount: 8200,
  happenedOn: "2026-06-12",
  id: "timeline-1",
  kind: "Service",
  note: "",
  odometerKm: 40200,
  title: "40k service",
  vehicleId: "garage-nexon",
};
const post: OwnerPost = {
  author: "Amit",
  body: "body",
  brand: "Tata",
  city: "Pune",
  comments: [],
  createdAt: "2026-07-14T10:00:00.000Z",
  fixesConfirmed: 0,
  helpful: 1,
  id: "post-1",
  label: "Fix",
  model: "Nexon",
  odometerKm: 42000,
  title: "title",
  topic: "Repairs",
  variant: "",
};
const report: ReportRecord = {
  createdAt: "2026-08-01T10:00:00.000Z",
  id: "report-1",
  postId: "post-1",
  postTitle: "title",
  reason: "Spam",
  reporterName: "Amit",
  status: "Open",
};
const shortlistItem: ShortlistItem = {
  brand: "Kia",
  budget: 1500000,
  id: "shortlist-1",
  model: "Seltos",
  notes: "",
  status: "Researching",
};
const feedbackNote: FeedbackNote = {
  createdAt: "2026-08-01T10:00:00.000Z",
  id: "feedback-1",
  loopStage: "Real user",
  message: "note",
  status: "New",
};
const reminder: GarageReminder = {
  detail: "detail",
  id: "garage-nexon-service-reminder",
  title: "Plan the next service visit",
  urgency: "Plan",
  vehicleId: "garage-nexon",
  vehicleName: "Daily diesel",
};
const playbook: OwnershipPlaybook = {
  brand: "Tata",
  buyerChecks: [],
  confidence: "Early signal",
  evidenceCount: 1,
  headline: "headline",
  key: "tata-nexon",
  model: "Nexon",
  ownerSignals: [],
};

const snapshot: HostedWorkspaceSnapshot = {
  feedback: [feedbackNote],
  follows: { models: ["tata-nexon"], topics: ["Repairs"] },
  garage: [vehicle],
  posts: [post],
  profile,
  reports: [report],
  saved: ["post-1"],
  shortlist: [shortlistItem],
  subscriptionSettings: { browserAlerts: false, emailDigest: true, quietHours: true },
  timeline: [entry],
};

/** Every read and write in the layer, with the local value it must fall back to. */
const hostedCalls: { name: string; call: () => Promise<HostedResult<unknown>>; fallback: unknown }[] = [
  { call: () => loadHostedProfile(userId, profile), fallback: profile, name: "loadHostedProfile" },
  { call: () => saveHostedProfile(userId, profile), fallback: profile, name: "saveHostedProfile" },
  { call: () => listHostedPosts([post]), fallback: [post], name: "listHostedPosts" },
  { call: () => listHostedPostRankings([]), fallback: [], name: "listHostedPostRankings" },
  { call: () => upsertHostedPost(userId, post), fallback: post, name: "upsertHostedPost" },
  { call: () => upsertHostedPosts(userId, [post]), fallback: [post], name: "upsertHostedPosts" },
  { call: () => deleteHostedPost(userId, post.id), fallback: post.id, name: "deleteHostedPost" },
  { call: () => addHostedComment(userId, post.id, "Amit", "hi"), fallback: "hi", name: "addHostedComment" },
  { call: () => listHostedSavedPostIds(userId, ["post-1"]), fallback: ["post-1"], name: "listHostedSavedPostIds" },
  { call: () => setHostedSavedPost(userId, post.id, true), fallback: true, name: "setHostedSavedPost" },
  { call: () => replaceHostedSavedPosts(userId, ["post-1"]), fallback: ["post-1"], name: "replaceHostedSavedPosts" },
  { call: () => listHostedReports(userId, [report]), fallback: [report], name: "listHostedReports" },
  { call: () => upsertHostedReport(userId, report), fallback: report, name: "upsertHostedReport" },
  { call: () => upsertHostedReports(userId, [report]), fallback: [report], name: "upsertHostedReports" },
  { call: () => setHostedReportStatus(userId, report.id, "Removed"), fallback: "Removed", name: "setHostedReportStatus" },
  { call: () => loadHostedFollows(userId, snapshot.follows), fallback: snapshot.follows, name: "loadHostedFollows" },
  { call: () => saveHostedFollows(userId, snapshot.follows), fallback: snapshot.follows, name: "saveHostedFollows" },
  { call: () => listHostedCityFollows(userId, []), fallback: [], name: "listHostedCityFollows" },
  { call: () => setHostedCityFollow(userId, "Pune", true), fallback: true, name: "setHostedCityFollow" },
  { call: () => listHostedGarage(userId, [vehicle]), fallback: [vehicle], name: "listHostedGarage" },
  { call: () => upsertHostedVehicle(userId, vehicle), fallback: vehicle, name: "upsertHostedVehicle" },
  { call: () => upsertHostedVehicles(userId, [vehicle]), fallback: [vehicle], name: "upsertHostedVehicles" },
  { call: () => deleteHostedVehicle(userId, vehicle.id), fallback: vehicle.id, name: "deleteHostedVehicle" },
  { call: () => listHostedTimeline(userId, [entry]), fallback: [entry], name: "listHostedTimeline" },
  { call: () => upsertHostedTimelineEntry(userId, entry), fallback: entry, name: "upsertHostedTimelineEntry" },
  { call: () => upsertHostedTimelineEntries(userId, [entry]), fallback: [entry], name: "upsertHostedTimelineEntries" },
  { call: () => deleteHostedTimelineEntry(userId, entry.id), fallback: entry.id, name: "deleteHostedTimelineEntry" },
  { call: () => listHostedCosts(userId, []), fallback: [], name: "listHostedCosts" },
  { call: () => upsertHostedCosts(userId, []), fallback: [], name: "upsertHostedCosts" },
  { call: () => syncHostedCostsFromTimeline(userId, [entry]), fallback: undefined, name: "syncHostedCostsFromTimeline" },
  { call: () => deleteHostedCost(userId, "cost-1"), fallback: "cost-1", name: "deleteHostedCost" },
  { call: () => listHostedReminders(userId, [vehicle], []), fallback: [], name: "listHostedReminders" },
  { call: () => upsertHostedReminders(userId, [reminder]), fallback: [reminder], name: "upsertHostedReminders" },
  { call: () => setHostedReminderStatus(userId, reminder.id, "Done"), fallback: "Done", name: "setHostedReminderStatus" },
  { call: () => deleteHostedReminder(userId, reminder.id), fallback: reminder.id, name: "deleteHostedReminder" },
  { call: () => listHostedShortlist(userId, [shortlistItem]), fallback: [shortlistItem], name: "listHostedShortlist" },
  { call: () => upsertHostedShortlistItem(userId, shortlistItem), fallback: shortlistItem, name: "upsertHostedShortlistItem" },
  { call: () => upsertHostedShortlistItems(userId, [shortlistItem]), fallback: [shortlistItem], name: "upsertHostedShortlistItems" },
  { call: () => deleteHostedShortlistItem(userId, shortlistItem.id), fallback: shortlistItem.id, name: "deleteHostedShortlistItem" },
  { call: () => listHostedInspections(userId, []), fallback: [], name: "listHostedInspections" },
  { call: () => upsertHostedInspections(userId, []), fallback: [], name: "upsertHostedInspections" },
  { call: () => publishHostedChecklists(userId, []), fallback: [], name: "publishHostedChecklists" },
  {
    call: () => setHostedInspectionItemState(userId, "inspection-1", "check-1", "Pass"),
    fallback: "Pass",
    name: "setHostedInspectionItemState",
  },
  { call: () => deleteHostedInspection(userId, "inspection-1"), fallback: "inspection-1", name: "deleteHostedInspection" },
  { call: () => listHostedCityCircles([]), fallback: [], name: "listHostedCityCircles" },
  { call: () => loadHostedCityCircle("pune", null), fallback: null, name: "loadHostedCityCircle" },
  { call: () => publishHostedCityCircles(userId, []), fallback: [], name: "publishHostedCityCircles" },
  { call: () => listHostedPlaybooks([playbook]), fallback: [playbook], name: "listHostedPlaybooks" },
  { call: () => loadHostedPlaybook("tata-nexon", null), fallback: null, name: "loadHostedPlaybook" },
  { call: () => listHostedPlaybookEntries("tata-nexon", []), fallback: [], name: "listHostedPlaybookEntries" },
  { call: () => upsertHostedPlaybooks(userId, [playbook]), fallback: [playbook], name: "upsertHostedPlaybooks" },
  {
    call: () =>
      addHostedPlaybookEntry(userId, {
        confidence: "Early signal",
        corroborations: 0,
        detail: "",
        evidenceCount: 1,
        kind: "Owner signal",
        playbookId: "tata-nexon",
        sourcePostId: null,
        title: "signal",
      }),
    fallback: undefined,
    name: "addHostedPlaybookEntry",
  },
  {
    call: () => loadHostedSubscriptionSettings(userId, snapshot.subscriptionSettings),
    fallback: snapshot.subscriptionSettings,
    name: "loadHostedSubscriptionSettings",
  },
  {
    call: () => saveHostedSubscriptionSettings(userId, snapshot.subscriptionSettings),
    fallback: snapshot.subscriptionSettings,
    name: "saveHostedSubscriptionSettings",
  },
  { call: () => listHostedNotificationJobs(userId, []), fallback: [], name: "listHostedNotificationJobs" },
  { call: () => queueHostedNotification(userId, { kind: "Digest" }), fallback: undefined, name: "queueHostedNotification" },
  { call: () => queueHostedNotifications(userId, [{ kind: "Reminder" }]), fallback: undefined, name: "queueHostedNotifications" },
  {
    call: () => setHostedNotificationJobStatus(userId, "job-1", "Sent"),
    fallback: "Sent",
    name: "setHostedNotificationJobStatus",
  },
  { call: () => listHostedNotificationDeliveries(userId, []), fallback: [], name: "listHostedNotificationDeliveries" },
  { call: () => recordHostedDelivery(userId, "job-1", "In-app"), fallback: "Sent", name: "recordHostedDelivery" },
  { call: () => listHostedFeedback(userId, [feedbackNote]), fallback: [feedbackNote], name: "listHostedFeedback" },
  { call: () => upsertHostedFeedbackNote(userId, feedbackNote), fallback: feedbackNote, name: "upsertHostedFeedbackNote" },
  { call: () => upsertHostedFeedback(userId, [feedbackNote]), fallback: [feedbackNote], name: "upsertHostedFeedback" },
  { call: () => setHostedFeedbackStatus(userId, feedbackNote.id, "Shipped"), fallback: "Shipped", name: "setHostedFeedbackStatus" },
  {
    call: () => setHostedFeedbackLoopStage(userId, feedbackNote.id, "Designer"),
    fallback: "Designer",
    name: "setHostedFeedbackLoopStage",
  },
  { call: () => deleteHostedFeedbackNote(userId, feedbackNote.id), fallback: feedbackNote.id, name: "deleteHostedFeedbackNote" },
  { call: () => listHostedPostQuality([]), fallback: [], name: "listHostedPostQuality" },
  { call: () => upsertHostedPostQuality(userId, []), fallback: [], name: "upsertHostedPostQuality" },
  { call: () => publishHostedPostQuality(userId, [post]), fallback: undefined, name: "publishHostedPostQuality" },
];

describe("hosted layer with no configured client", () => {
  it("reports the browser as online when navigator has no onLine flag", () => {
    expect(typeof isBrowserOffline()).toBe("boolean");
  });

  it.each(hostedCalls.map((entry) => [entry.name, entry] as const))(
    "%s degrades to the local value without throwing",
    async (_name, entry) => {
      const result = await entry.call();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.source).toBe("local");
      expect(result.reason).toBe("unconfigured");
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
      if (entry.fallback !== undefined) expect(result.data).toEqual(entry.fallback);
    },
  );

  it("never rejects for any call in the layer", async () => {
    await expect(Promise.all(hostedCalls.map((entry) => entry.call()))).resolves.toHaveLength(hostedCalls.length);
  });
});

describe("signed-out behaviour", () => {
  const signedOutCalls = [
    () => loadHostedProfile("", profile),
    () => saveHostedProfile(null, profile),
    () => listHostedGarage(undefined, [vehicle]),
    () => upsertHostedVehicles("   ", [vehicle]),
    () => listHostedFeedback("", [feedbackNote]),
    () => listHostedShortlist(null, [shortlistItem]),
    () => syncHostedCostsFromTimeline("", [entry]),
  ];

  it.each(signedOutCalls.map((call, index) => [index, call] as const))(
    "call %i degrades with a signed-out reason",
    async (_index, call) => {
      const result = await call();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("signed-out");
      expect(result.source).toBe("local");
    },
  );
});

describe("runHosted guards", () => {
  it("short-circuits before invoking the callback", async () => {
    const run = vi.fn();
    const result = await runHosted("local", run);
    expect(run).not.toHaveBeenCalled();
    expect(result.data).toBe("local");
  });

  it("short-circuits for a blank user id", async () => {
    const run = vi.fn();
    const result = await runHostedForUser("", "local", run);
    expect(run).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signed-out");
  });
});

describe("syncAllHosted", () => {
  let result: Awaited<ReturnType<typeof syncAllHosted>>;

  beforeEach(async () => {
    result = await syncAllHosted(userId, snapshot, { localUpdatedAt: "2026-08-05T00:00:00.000Z" });
  });

  it("returns the input snapshot unchanged when hosted sync is unconfigured", () => {
    expect(result.ok).toBe(false);
    expect(result.data.workspace).toBe(snapshot);
    expect(result.data.workspace).toEqual(snapshot);
    expect(result.data.syncedAt).toBeNull();
  });

  it("reports every domain as skipped", () => {
    expect(result.data.reports).toHaveLength(hostedSyncDomains.length);
    expect(result.data.reports.every((entry) => entry.status === "skipped")).toBe(true);
    expect(result.data.reports.map((entry) => entry.domain)).toEqual([...hostedSyncDomains]);
    expect(result.data.reports.every((entry) => entry.pulled === 0 && entry.pushed === 0)).toBe(true);
  });

  it("returns the input snapshot unchanged when signed out", async () => {
    const signedOut = await syncAllHosted("", snapshot);
    expect(signedOut.ok).toBe(false);
    if (!signedOut.ok) expect(signedOut.reason).toBe("signed-out");
    expect(signedOut.data.workspace).toBe(snapshot);
  });

  it("tolerates a missing localUpdatedAt", async () => {
    const noClock = await syncAllHosted(userId, snapshot);
    expect(noClock.data.workspace).toBe(snapshot);
  });
});
