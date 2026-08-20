import { describe, expect, it } from "vitest";
import type { FeedbackNote, GarageVehicle, OwnerPost, Profile, ReportRecord, ShortlistItem, TimelineEntry } from "../../core/entities";
import type { CityCircle, GarageReminder, InspectionChecklist, OwnershipPlaybook } from "../../insights";
import { assessPostQuality, buildCityCircles, modelKeyFor } from "../../insights";
import {
  asAmount,
  asCount,
  asDateOnly,
  asIsoTimestamp,
  asNullableDateOnly,
  asOneOf,
  asStringList,
  asText,
  channelForSettings,
  checklistToSession,
  cityCircleToHosted,
  cityRowToHosted,
  costCategoryForTimelineKind,
  costRowToLocal,
  costToRow,
  costsFromTimeline,
  feedbackRowToLocal,
  feedbackToRow,
  followRowToLocal,
  followStateToRow,
  hostedCityToLocal,
  hostedCityToRow,
  inspectionSessionRowToLocal,
  mergeFollowStates,
  mergeKeyedCollection,
  mergePostCollections,
  mergeSingleton,
  mergeStringSets,
  notificationJobRowToLocal,
  playbookRowToLocal,
  playbookToEntries,
  playbookToRow,
  postRowToLocal,
  postToQuality,
  postToRow,
  profileRowToLocal,
  profileToRow,
  qualityRowToLocal,
  rankPosts,
  rankingScoreFor,
  reminderKindForLocalId,
  reminderRowToLocal,
  reminderToRow,
  reportRowToLocal,
  reportToRow,
  sessionToChecklist,
  shortlistItemToRow,
  shortlistRowToLocal,
  slugify,
  sortFeedbackByRecency,
  subscriptionRowToLocal,
  subscriptionToRow,
  timelineEntryToCost,
  timelineEntryToRow,
  timelineRowToLocal,
  timestampOf,
  vehicleNameIndex,
  vehicleRowToLocal,
  vehicleToRow,
  qualityIndex,
} from "./index";
import type {
  CityCircleRow,
  FeedbackEntryRow,
  GarageReminderRow,
  GarageVehicleRow,
  InspectionSessionRow,
  ModelPlaybookRow,
  NotificationJobRow,
  OwnerPostRow,
  PostQualityScoreRow,
  ReportRow,
  ShortlistItemRow,
  TimelineEntryRow,
} from "./index";

const stamps = {
  created_at: "2026-08-01T10:00:00.000Z",
  updated_at: "2026-08-02T10:00:00.000Z",
};

describe("hosted coercion helpers", () => {
  it("keeps usable text and falls back for missing values", () => {
    expect(asText("Pune")).toBe("Pune");
    expect(asText(null, "fallback")).toBe("fallback");
    expect(asText(undefined)).toBe("");
    expect(asText(42)).toBe("42");
    expect(asText({ nope: true }, "safe")).toBe("safe");
  });

  it("coerces numeric columns that arrive as strings and clamps negatives", () => {
    expect(asCount("42000")).toBe(42000);
    expect(asCount(-5)).toBe(0);
    expect(asCount(null, 7)).toBe(7);
    expect(asCount(12.9)).toBe(12);
    expect(asAmount("1350.75")).toBe(1350.75);
    expect(asAmount("not-a-number")).toBe(0);
    expect(asAmount(Number.NaN)).toBe(0);
  });

  it("collapses unknown enum members to the safe local default", () => {
    expect(asOneOf("Hot", ["Quiet", "Active", "Hot"] as const, "Quiet")).toBe("Hot");
    expect(asOneOf("Volcanic", ["Quiet", "Active", "Hot"] as const, "Quiet")).toBe("Quiet");
    expect(asOneOf(null, ["Quiet"] as const, "Quiet")).toBe("Quiet");
    expect(asOneOf(7, ["Quiet"] as const, "Quiet")).toBe("Quiet");
  });

  it("normalises dates and timestamps in both directions", () => {
    expect(asDateOnly("2026-04-18")).toBe("2026-04-18");
    expect(asDateOnly("2026-04-18T09:30:00.000Z")).toBe("2026-04-18");
    expect(asDateOnly("garbage", "2026-01-01")).toBe("2026-01-01");
    expect(asNullableDateOnly(null)).toBeNull();
    expect(asNullableDateOnly("")).toBeNull();
    expect(asIsoTimestamp("2026-07-14T10:00:00.000Z")).toBe("2026-07-14T10:00:00.000Z");
    expect(asIsoTimestamp("nonsense", "2026-01-01T00:00:00.000Z")).toBe("2026-01-01T00:00:00.000Z");
    expect(timestampOf("nope")).toBe(0);
    expect(timestampOf(null)).toBe(0);
    expect(timestampOf("2026-08-02T10:00:00.000Z")).toBe(Date.parse("2026-08-02T10:00:00.000Z"));
  });

  it("drops non-string array members and slugifies city names", () => {
    expect(asStringList(["Tata", 7, null, "Kia", ""])).toEqual(["Tata", "Kia"]);
    expect(asStringList("Tata")).toEqual([]);
    expect(slugify("Delhi NCR")).toBe("delhi-ncr");
    expect(slugify("  Bengaluru  ")).toBe("bengaluru");
    expect(slugify("!!!")).toBe("");
  });
});

describe("profile mappers", () => {
  const profile: Profile = { city: "Pune", displayName: "Amit", garageRole: "Mechanic" };

  it("round trips local → hosted → local", () => {
    const row = profileToRow("user-1", profile);
    expect(row.user_id).toBe("user-1");
    expect(profileRowToLocal({ city: row.city!, display_name: row.display_name!, garage_role: row.garage_role! })).toEqual(profile);
  });

  it("falls back to Owner for an unknown hosted role and empty text for nulls", () => {
    expect(profileRowToLocal({ city: null as unknown as string, display_name: null as unknown as string, garage_role: "Overlord" })).toEqual({
      city: "",
      displayName: "",
      garageRole: "Owner",
    });
  });
});

describe("community mappers", () => {
  const post: OwnerPost = {
    author: "Amit from Pune",
    body: "The clutch pedal changed slowly. Dealer cleaned the linkage and it held for 4,000 km.",
    brand: "Tata",
    city: "Pune",
    comments: [],
    createdAt: "2026-07-14T10:00:00.000Z",
    fixesConfirmed: 7,
    helpful: 31,
    id: "nexon-diesel-clutch",
    label: "Fix",
    model: "Nexon",
    odometerKm: 42000,
    title: "Nexon diesel clutch fix",
    topic: "Repairs",
    fuel: "Diesel",
    variant: "XZ+",
  };

  it("round trips local → hosted → local", () => {
    const row = postToRow("user-1", post) as OwnerPostRow;
    expect(postRowToLocal({ ...row, ...stamps, created_at: post.createdAt } as OwnerPostRow)).toEqual(post);
  });

  it("collapses an unknown label and coerces numeric strings", () => {
    const decoded = postRowToLocal(
      {
        ...(postToRow("user-1", post) as OwnerPostRow),
        ...stamps,
        fixes_confirmed: "7" as unknown as number,
        helpful: "31" as unknown as number,
        label: "Hot take",
        odometer_km: -1 as unknown as number,
      } as OwnerPostRow,
      ["Anon: same here"],
    );
    expect(decoded.label).toBe("Owner note");
    expect(decoded.helpful).toBe(31);
    expect(decoded.fixesConfirmed).toBe(7);
    expect(decoded.odometerKm).toBe(0);
    expect(decoded.comments).toEqual(["Anon: same here"]);
  });

  it("merges hosted and local feeds without losing local signal", () => {
    const local: OwnerPost = { ...post, comments: ["a", "b"], helpful: 40 };
    const hosted: OwnerPost = { ...post, comments: ["a"], helpful: 12, fixesConfirmed: 9 };
    const merged = mergePostCollections([local], [hosted]);
    expect(merged).toHaveLength(1);
    expect(merged[0].helpful).toBe(40);
    expect(merged[0].fixesConfirmed).toBe(9);
    expect(merged[0].comments).toEqual(["a", "b"]);
  });

  it("round trips reports and defaults an unknown status to Open", () => {
    const report: ReportRecord = {
      createdAt: "2026-08-01T10:00:00.000Z",
      id: "report-1",
      postId: "nexon-diesel-clutch",
      postTitle: "Nexon diesel clutch fix",
      reason: "Spam",
      reporterName: "Amit",
      status: "Removed",
    };
    const row = reportToRow("user-1", report) as ReportRow;
    expect(reportRowToLocal({ ...row, ...stamps, created_at: report.createdAt } as ReportRow)).toEqual(report);
    expect(reportRowToLocal({ ...row, ...stamps, status: "Escalated" } as ReportRow).status).toBe("Open");
  });
  it("keeps an unstated fuel empty instead of guessing one", () => {
    const withoutFuel: OwnerPost = { ...post, fuel: "", variant: "XZ+" };
    const row = postToRow("user-1", withoutFuel);
    expect(row.fuel).toBeNull();
    expect(postRowToLocal({ ...row, comments: [] } as never).fuel).toBe("");
  });

});

describe("follow mappers", () => {
  it("round trips and treats a missing row as an empty follow state", () => {
    const follows = { models: ["tata-nexon"], topics: ["Repairs"] };
    const row = followStateToRow("user-1", follows);
    expect(followRowToLocal({ models: row.models!, topics: row.topics! })).toEqual(follows);
    expect(followRowToLocal(null)).toEqual({ models: [], topics: [] });
  });

  it("merges follow states additively without duplicates", () => {
    expect(mergeFollowStates({ models: ["a", "b"], topics: [] }, { models: ["b", "c"], topics: ["Repairs"] })).toEqual({
      models: ["a", "b", "c"],
      topics: ["Repairs"],
    });
  });
});

describe("garage mappers", () => {
  const vehicle: GarageVehicle = {
    brand: "Tata",
    city: "Pune",
    fuel: "Diesel",
    id: "garage-nexon",
    model: "Nexon",
    nickname: "Daily drive",
    odometerKm: 42000,
    ownership: "First owner",
    purchaseMonth: "2021-08",
    transmission: "MT",
    variant: "XZ+",
  };
  const entry: TimelineEntry = {
    amount: 8200,
    happenedOn: "2026-06-12",
    id: "timeline-nexon-service",
    kind: "Service",
    note: "Oil, filters, alignment.",
    odometerKm: 40200,
    title: "40k km scheduled service",
    vehicleId: "garage-nexon",
  };

  it("round trips vehicles and rejects a malformed purchase month", () => {
    const row = vehicleToRow("user-1", vehicle) as GarageVehicleRow;
    expect(vehicleRowToLocal({ ...row, ...stamps } as GarageVehicleRow)).toEqual(vehicle);
    expect(vehicleRowToLocal({ ...row, ...stamps, purchase_month: "August 2021" } as GarageVehicleRow).purchaseMonth).toBe("");
  });

  it("keeps unrecorded fuel, transmission and ownership empty rather than guessing", () => {
    const blank = { ...vehicle, fuel: "" as const, ownership: "" as const, transmission: "" as const };
    const row = vehicleToRow("user-1", blank) as GarageVehicleRow;
    expect(row.fuel).toBeNull();
    expect(row.transmission).toBeNull();
    expect(row.ownership).toBeNull();
    const decoded = vehicleRowToLocal({ ...row, ...stamps } as GarageVehicleRow);
    expect(decoded).toEqual(blank);
  });

  it("round trips timeline entries and defaults an unknown kind to Note", () => {
    const row = timelineEntryToRow("user-1", entry) as TimelineEntryRow;
    expect(timelineRowToLocal({ ...row, ...stamps } as TimelineEntryRow)).toEqual(entry);
    const odd = timelineRowToLocal({ ...row, ...stamps, amount: "8200.50" as unknown as number, kind: "Detailing" } as TimelineEntryRow);
    expect(odd.kind).toBe("Note");
    expect(odd.amount).toBe(8200.5);
  });

  it("derives ledger rows from priced timeline notes only", () => {
    const costs = costsFromTimeline([entry, { ...entry, amount: 0, id: "timeline-free" }]);
    expect(costs).toHaveLength(1);
    expect(costs[0].id).toBe("cost-timeline-nexon-service");
    expect(costs[0].timelineEntryId).toBe("timeline-nexon-service");
    expect(costCategoryForTimelineKind("Note")).toBe("Other");
    expect(costCategoryForTimelineKind("Tyres")).toBe("Tyres");
  });

  it("round trips ledger rows local → hosted → local", () => {
    const cost = timelineEntryToCost(entry);
    const row = costToRow("user-1", cost);
    expect(costRowToLocal({ ...row, ...stamps } as never)).toEqual(cost);
  });

  it("round trips reminders and rehydrates the vehicle name", () => {
    const reminder: GarageReminder = {
      detail: "500 km left before the 50,000 km checkpoint.",
      id: "garage-nexon-service-reminder",
      title: "Plan the next service visit",
      urgency: "Soon",
      vehicleId: "garage-nexon",
      vehicleName: "Daily drive",
    };
    const row = reminderToRow("user-1", reminder) as GarageReminderRow;
    expect(row.kind).toBe("Service");
    const decoded = reminderRowToLocal({ ...row, ...stamps } as GarageReminderRow, vehicleNameIndex([vehicle]));
    expect(decoded.vehicleName).toBe("Daily drive");
    expect(decoded.urgency).toBe("Soon");
    expect(decoded.status).toBe("Open");
    expect(reminderRowToLocal({ ...row, ...stamps, urgency: "Yesterday" } as GarageReminderRow).urgency).toBe("Plan");
    expect(reminderRowToLocal({ ...row, ...stamps } as GarageReminderRow).vehicleName).toBe("garage-nexon");
  });

  it("infers the hosted reminder kind from the local reminder id", () => {
    expect(reminderKindForLocalId("garage-nexon-insurance-renewal")).toBe("Insurance");
    expect(reminderKindForLocalId("garage-nexon-tyre-watch")).toBe("Tyres");
    expect(reminderKindForLocalId("garage-nexon-service-reminder")).toBe("Service");
    expect(reminderKindForLocalId("garage-nexon-something-else")).toBe("Custom");
  });
});

describe("shortlist mappers", () => {
  const item: ShortlistItem = {
    brand: "Kia",
    budget: 1500000,
    id: "shortlist-kia-seltos-1",
    model: "Seltos",
    notes: "Check DCT heat notes.",
    status: "Negotiating",
  };

  it("round trips and defaults an unknown status to Researching", () => {
    const row = shortlistItemToRow("user-1", item) as ShortlistItemRow;
    expect(shortlistRowToLocal({ ...row, ...stamps } as ShortlistItemRow)).toEqual(item);
    expect(shortlistRowToLocal({ ...row, ...stamps, status: "Ghosted" } as ShortlistItemRow).status).toBe("Researching");
  });
});

describe("inspection mappers", () => {
  const checklist: InspectionChecklist = {
    checklist: [
      { detail: "Owner note: clutch", id: "shortlist-1-known-issue", priority: "High", title: "Inspect known concern" },
      { detail: "Baseline", id: "shortlist-1-baseline", priority: "Low", title: "Run the baseline inspection" },
    ],
    item: { brand: "Kia", budget: 1500000, id: "shortlist-1", model: "Seltos", notes: "", status: "Test drive" },
  };

  it("round trips a local checklist through a hosted session", () => {
    const session = checklistToSession(checklist);
    expect(session.id).toBe("inspection-shortlist-1");
    expect(session.shortlistItemId).toBe("shortlist-1");
    expect(session.checklist.every((item) => item.state === "Pending")).toBe(true);
    const restored = sessionToChecklist(session, new Map([[checklist.item.id, checklist.item]]));
    expect(restored).toEqual(checklist);
  });

  it("synthesises a shortlist item when the hosted link is gone", () => {
    const session = checklistToSession(checklist);
    const restored = sessionToChecklist({ ...session, shortlistItemId: null });
    expect(restored.item.id).toBe(session.id);
    expect(restored.item.brand).toBe("Kia");
    expect(restored.item.status).toBe("Researching");
  });

  it("collapses unknown hosted status and verdict values", () => {
    const row = {
      brand: "Kia",
      city: "",
      completed_at: null,
      id: "inspection-shortlist-1",
      model: "Seltos",
      notes: "",
      odometer_km: 0,
      shortlist_item_id: null,
      status: "Ghosted",
      user_id: "user-1",
      variant: "",
      verdict: "Maybe",
      ...stamps,
    } as unknown as InspectionSessionRow;
    const session = inspectionSessionRowToLocal(row);
    expect(session.status).toBe("In progress");
    expect(session.verdict).toBe("");
    expect(session.checklist).toEqual([]);
  });
});

describe("city mappers", () => {
  const posts: OwnerPost[] = [
    {
      author: "Amit",
      body: "note",
      brand: "Tata",
      city: "Pune",
      comments: [],
      createdAt: "2026-07-14T10:00:00.000Z",
      fixesConfirmed: 0,
      helpful: 1,
      id: "post-1",
      label: "Fix",
      model: "Nexon",
      odometerKm: 1000,
      title: "title",
      topic: "Repairs",
      variant: "",
    },
  ];
  const garage: GarageVehicle[] = [
    { brand: "Tata", city: "Pune", id: "garage-1", model: "Nexon", nickname: "Daily", odometerKm: 1, purchaseMonth: "", variant: "" },
  ];

  it("round trips a derived city circle through the hosted row", () => {
    const [circle] = buildCityCircles(posts, garage) as CityCircle[];
    const hosted = cityCircleToHosted(circle);
    expect(hosted.slug).toBe("pune");
    expect(hosted.postCount).toBe(1);
    expect(hosted.garageCount).toBe(1);
    const row = hostedCityToRow("user-1", hosted) as CityCircleRow;
    const decoded = cityRowToHosted({ ...row, ...stamps, computed_at: stamps.created_at } as CityCircleRow);
    expect(decoded.city).toBe("Pune");
    expect(hostedCityToLocal(decoded, posts, garage)).toEqual(circle);
  });

  it("collapses unknown signals and hot topics", () => {
    const row = {
      city: "Pune",
      computed_at: stamps.created_at,
      curated_by: null,
      garage_count: 0,
      headline: "",
      hot_topics: ["Fix", "Vibes", 9],
      local_signal: "Molten",
      post_count: 0,
      slug: "pune",
      state: "",
      summary: "",
      top_brands: [],
      ...stamps,
    } as unknown as CityCircleRow;
    const decoded = cityRowToHosted(row);
    expect(decoded.localSignal).toBe("Quiet");
    expect(decoded.hotTopics).toEqual(["Fix", "Owner note"]);
  });
});

describe("playbook mappers", () => {
  const playbook: OwnershipPlaybook = {
    brand: "Tata",
    buyerChecks: ["Read known issues first."],
    confidence: "Useful base",
    evidenceCount: 3,
    headline: "Known issues and fixes are both visible.",
    key: modelKeyFor("Tata", "Nexon"),
    model: "Nexon",
    ownerSignals: ["Confirmed fixes are available.", "Cost notes are present."],
  };

  it("round trips local → hosted → local", () => {
    const row = playbookToRow("user-1", playbook) as ModelPlaybookRow;
    expect(row.id).toBe("tata-nexon");
    expect(playbookRowToLocal({ ...row, ...stamps, computed_at: stamps.created_at } as ModelPlaybookRow)).toEqual(playbook);
  });

  it("collapses an unknown confidence value", () => {
    const row = playbookToRow("user-1", playbook) as ModelPlaybookRow;
    expect(
      playbookRowToLocal({ ...row, ...stamps, computed_at: stamps.created_at, confidence: "Vibes" } as ModelPlaybookRow).confidence,
    ).toBe("Early signal");
  });

  it("splits a playbook into owner-signal and buyer-check entries", () => {
    const entries = playbookToEntries(playbook);
    expect(entries).toHaveLength(3);
    expect(entries.filter((entry) => entry.kind === "Owner signal")).toHaveLength(2);
    expect(entries.filter((entry) => entry.kind === "Buyer check")).toHaveLength(1);
    expect(entries.every((entry) => entry.playbookId === "tata-nexon")).toBe(true);
  });
});

describe("notification mappers", () => {
  it("round trips subscription settings and defaults a missing row", () => {
    const settings = { browserAlerts: true, emailDigest: false, quietHours: false };
    const row = subscriptionToRow("user-1", settings);
    expect(
      subscriptionRowToLocal({ browser_alerts: row.browser_alerts!, email_digest: row.email_digest!, quiet_hours: row.quiet_hours! }),
    ).toEqual(settings);
    expect(subscriptionRowToLocal(null)).toEqual({ browserAlerts: false, emailDigest: true, quietHours: true });
  });

  it("picks a channel from local preferences", () => {
    expect(channelForSettings({ browserAlerts: false, emailDigest: true, quietHours: true })).toBe("Email digest");
    expect(channelForSettings({ browserAlerts: true, emailDigest: false, quietHours: true })).toBe("Browser alert");
    expect(channelForSettings({ browserAlerts: false, emailDigest: false, quietHours: true })).toBe("In-app");
  });

  it("collapses unknown job kinds, channels, and statuses", () => {
    const row = {
      attempts: -3,
      channel: "Carrier pigeon",
      delivered_at: null,
      id: "job-1",
      kind: "Telepathy",
      last_error: "",
      payload: ["not", "an", "object"],
      scheduled_for: "2026-08-02T10:00:00.000Z",
      status: "Pending",
      user_id: "user-1",
      ...stamps,
    } as unknown as NotificationJobRow;
    const job = notificationJobRowToLocal(row);
    expect(job.kind).toBe("Digest");
    expect(job.channel).toBe("In-app");
    expect(job.status).toBe("Queued");
    expect(job.attempts).toBe(0);
    expect(job.payload).toEqual({});
    expect(job.deliveredAt).toBeNull();
  });
});

describe("feedback mappers", () => {
  const note: FeedbackNote = {
    createdAt: "2026-08-01T10:00:00.000Z",
    id: "feedback-1",
    loopStage: "Tested / QA",
    message: "Filters are hard to reach on phone.",
    status: "Reviewing",
  };

  it("round trips local → hosted → local", () => {
    const row = feedbackToRow("user-1", note) as FeedbackEntryRow;
    expect(feedbackRowToLocal({ ...row, ...stamps, created_at: note.createdAt } as FeedbackEntryRow)).toEqual(note);
  });

  it("collapses unknown loop stages and statuses", () => {
    const row = feedbackToRow("user-1", note) as FeedbackEntryRow;
    const decoded = feedbackRowToLocal({ ...row, ...stamps, loop_stage: "Intern", status: "Ignored" } as FeedbackEntryRow);
    expect(decoded.loopStage).toBe("Real user");
    expect(decoded.status).toBe("New");
  });

  it("sorts newest first", () => {
    const older: FeedbackNote = { ...note, createdAt: "2026-07-01T10:00:00.000Z", id: "feedback-0" };
    expect(sortFeedbackByRecency([older, note]).map((entry) => entry.id)).toEqual(["feedback-1", "feedback-0"]);
  });
});

describe("quality and ranking", () => {
  const post: OwnerPost = {
    author: "Amit",
    body: "Pedal feel changed slowly. Dealer quoted a full clutch but the linkage clean cost ₹1350 and the fix has held.",
    brand: "Tata",
    city: "Pune",
    comments: [],
    createdAt: "2026-07-14T10:00:00.000Z",
    fixesConfirmed: 7,
    helpful: 31,
    id: "post-1",
    label: "Fix",
    model: "Nexon",
    odometerKm: 42000,
    title: "Clutch fix",
    topic: "Repairs",
    variant: "XZ+ Diesel MT",
  };

  it("mirrors the local assessor and produces a finite ranking score", () => {
    const now = Date.parse("2026-08-01T00:00:00.000Z");
    const quality = postToQuality(post, now);
    const report = assessPostQuality(post);
    expect(quality.score).toBe(report.score);
    expect(quality.maxScore).toBe(report.maxScore);
    expect(quality.grade).toBe(report.grade);
    expect(quality.missingPrompts).toEqual(report.missingPrompts);
    expect(quality.postId).toBe("post-1");
    expect(Number.isFinite(quality.rankingScore)).toBe(true);
    expect(quality.rankingScore).toBeGreaterThan(0);
  });

  it("keeps the ranking score finite for a broken created date", () => {
    const report = assessPostQuality(post);
    expect(Number.isFinite(rankingScoreFor({ ...post, createdAt: "not-a-date" }, report))).toBe(true);
    expect(Number.isFinite(rankingScoreFor(post, { ...report, maxScore: 0, score: 0 }))).toBe(true);
  });

  it("collapses an unknown hosted grade and ranks by score then recency", () => {
    const row = {
      components: {},
      computed_at: stamps.created_at,
      grade: "Legendary",
      max_score: 6,
      missing_prompts: ["Add cost"],
      post_id: "post-1",
      ranking_score: "4.5",
      score: 5,
      strengths: ["Variant included"],
      user_id: "user-1",
      ...stamps,
    } as unknown as PostQualityScoreRow;
    const decoded = qualityRowToLocal(row);
    expect(decoded.grade).toBe("Needs context");
    expect(decoded.rankingScore).toBe(4.5);

    const older: OwnerPost = { ...post, createdAt: "2026-01-01T00:00:00.000Z", id: "post-0" };
    const scores = qualityIndex([
      { ...decoded, postId: "post-0", rankingScore: 9 },
      { ...decoded, postId: "post-1", rankingScore: 1 },
    ]);
    expect(rankPosts([post, older], scores).map((entry) => entry.id)).toEqual(["post-0", "post-1"]);
  });
});

describe("last-write-wins merge helpers", () => {
  const localClock = Date.parse("2026-08-05T00:00:00.000Z");
  const localItem: ShortlistItem = { brand: "Kia", budget: 1, id: "a", model: "Seltos", notes: "local", status: "Researching" };
  const hostedItem: ShortlistItem = { ...localItem, notes: "hosted" };

  it("lets a newer hosted record win and keeps it out of the push set", () => {
    const outcome = mergeKeyedCollection([localItem], [{ updatedAt: "2026-08-09T00:00:00.000Z", value: hostedItem }], localClock);
    expect(outcome.merged).toEqual([hostedItem]);
    expect(outcome.toPush).toEqual([]);
    expect(outcome.pulled).toBe(1);
  });

  it("lets the local record win and queues it for push when hosted is older", () => {
    const outcome = mergeKeyedCollection([localItem], [{ updatedAt: "2026-08-01T00:00:00.000Z", value: hostedItem }], localClock);
    expect(outcome.merged).toEqual([localItem]);
    expect(outcome.toPush).toEqual([localItem]);
    expect(outcome.pulled).toBe(0);
  });

  it("adopts hosted-only records and pushes local-only records", () => {
    const hostedOnly: ShortlistItem = { ...localItem, id: "b" };
    const outcome = mergeKeyedCollection([localItem], [{ updatedAt: "2026-08-09T00:00:00.000Z", value: hostedOnly }], localClock);
    expect(outcome.merged.map((item) => item.id).sort()).toEqual(["a", "b"]);
    expect(outcome.toPush).toEqual([localItem]);
    expect(outcome.pulled).toBe(1);
  });

  it("merges singletons and string sets", () => {
    expect(mergeSingleton("local", { updatedAt: "2026-08-09T00:00:00.000Z", value: "hosted" }, localClock)).toEqual({
      merged: "hosted",
      pulled: 1,
      pushNeeded: false,
    });
    expect(mergeSingleton("local", null, localClock)).toEqual({ merged: "local", pulled: 0, pushNeeded: true });
    expect(mergeStringSets(["a", "b", ""], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});
