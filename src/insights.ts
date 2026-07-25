import type {
  BuildRole,
  FeedbackNote,
  FeedbackStatus,
  FollowState,
  GarageVehicle,
  HostedApiReadinessItem,
  KnowledgeLabel,
  LaunchReadinessItem,
  ModelNotebook,
  OwnerPost,
  Profile,
  PrivacyReadinessItem,
  ProductionOpsItem,
  ProductionLaunchItem,
  QaSessionItem,
  ReportRecord,
  ResponsiveQaItem,
  ShortlistItem,
  StarterRoute,
  TesterRun,
  TimelineEntry,
} from "./domain";

export type SubscriptionPreference = {
  emailDigest: boolean;
  browserAlerts: boolean;
  quietHours: boolean;
};

export type GarageInsight = {
  id: string;
  title: string;
  detail: string;
  tone: "service" | "cost" | "community";
};

export type GarageCostLedger = {
  vehicle: GarageVehicle;
  totalSpend: number;
  entryCount: number;
  costPerKm: number | null;
  latestEntry: TimelineEntry | null;
  highestLoggedOdometerKm: number;
};

export type GarageReminder = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  title: string;
  detail: string;
  urgency: "Soon" | "Plan" | "Watch";
};

export type ModerationSummary = {
  openReports: number;
  dismissedReports: number;
  removedReports: number;
  riskyPostIds: string[];
};

export type FeedbackTriageSummary = Record<FeedbackStatus, number>;

export type FeedbackLoopSummary = Record<BuildRole, number>;

export type LaunchReadinessSummary = {
  ready: number;
  total: number;
  blocked: LaunchReadinessItem[];
};

export type StarterRouteProgress = StarterRoute & {
  complete: boolean;
};

export type ConnectionStatusCopy = {
  label: string;
  detail: string;
  tone: "online" | "offline";
};

export type QaSessionSummary = {
  checked: number;
  total: number;
  remaining: QaSessionItem[];
};

export type ResponsiveQaSummary = {
  checked: number;
  total: number;
  remaining: ResponsiveQaItem[];
};

export type ProductionLaunchSummary = {
  checked: number;
  total: number;
  remaining: ProductionLaunchItem[];
};

export type ProductionOpsSummary = {
  checked: number;
  total: number;
  remaining: ProductionOpsItem[];
};

export type PrivacyReadinessSummary = Record<PrivacyReadinessItem["stance"], number>;

export type TesterRunSummary = {
  total: number;
  useful: number;
  confusing: number;
  blocked: number;
  openFriction: TesterRun[];
};

export type HostedApiReadinessSummary = {
  launchBlockers: number;
  beta: number;
  later: number;
  serviceCenterBoundaries: number;
};

export type QaHandoffInput = {
  feedbackLoopSummary: FeedbackLoopSummary;
  feedbackSummary: FeedbackTriageSummary;
  generatedAt: string;
  hostedApiSummary: HostedApiReadinessSummary;
  launchSummary: LaunchReadinessSummary;
  profile: Profile;
  privacySummary: PrivacyReadinessSummary;
  productionLaunchSummary: ProductionLaunchSummary;
  productionOpsSummary: ProductionOpsSummary;
  productionUrl: string;
  qaSummary: QaSessionSummary;
  responsiveQaSummary: ResponsiveQaSummary;
  testerRunSummary: TesterRunSummary;
};

export type SharePayload = {
  title: string;
  text: string;
};

export type ShortlistComparison = {
  item: ShortlistItem;
  relatedNotes: number;
  knownIssues: number;
  fixes: number;
  ownerReviews: number;
  confidence: "Low" | "Medium" | "High";
};

export type InspectionChecklistItem = {
  id: string;
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
};

export type InspectionChecklist = {
  item: ShortlistItem;
  checklist: InspectionChecklistItem[];
};

export type CityCircle = {
  city: string;
  posts: OwnerPost[];
  garageVehicles: GarageVehicle[];
  topBrands: string[];
  hotTopics: KnowledgeLabel[];
  localSignal: "Quiet" | "Active" | "Hot";
};

export type OwnershipPlaybook = {
  key: string;
  brand: string;
  model: string;
  headline: string;
  confidence: "Early signal" | "Useful base" | "Strong pattern";
  ownerSignals: string[];
  buyerChecks: string[];
  evidenceCount: number;
};

export type PostQualityInput = Pick<OwnerPost, "body" | "city" | "label" | "odometerKm" | "variant">;

export type PostQualityReport = {
  score: number;
  maxScore: number;
  grade: "Needs context" | "Useful draft" | "Garage-grade";
  strengths: string[];
  missingPrompts: string[];
};

export const defaultSubscriptionPreference: SubscriptionPreference = {
  emailDigest: true,
  browserAlerts: false,
  quietHours: true,
};

export function modelKeyFor(brand: string, model: string): string {
  return `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function groupByModel(posts: OwnerPost[]): ModelNotebook[] {
  const notebooks = posts.reduce<Map<string, ModelNotebook>>((accumulator, post) => {
    const key = modelKeyFor(post.brand, post.model);
    const existing = accumulator.get(key);
    if (existing) {
      existing.posts.push(post);
      return accumulator;
    }

    accumulator.set(key, {
      key,
      brand: post.brand,
      model: post.model,
      posts: [post],
    });
    return accumulator;
  }, new Map<string, ModelNotebook>());

  return [...notebooks.values()].sort((first, second) => second.posts.length - first.posts.length);
}

export function filterPostsByMode(
  posts: OwnerPost[],
  options: {
    followedModelSet: Set<string>;
    followedTopicSet: Set<string>;
    mode: "latest" | "helpful" | "saved" | "following";
    query: string;
    saved: Set<string>;
    selectedLabel: KnowledgeLabel | "All";
  },
): OwnerPost[] {
  const normalizedQuery = options.query.trim().toLowerCase();
  const visible = posts.filter((post) => {
    const modelKey = modelKeyFor(post.brand, post.model);
    const matchesSaved = options.mode !== "saved" || options.saved.has(post.id);
    const matchesFollowing =
      options.mode !== "following" || options.followedModelSet.has(modelKey) || options.followedTopicSet.has(post.label);
    const matchesLabel = options.selectedLabel === "All" || post.label === options.selectedLabel;
    const haystack = `${post.title} ${post.brand} ${post.model} ${post.variant} ${post.city} ${post.body}`.toLowerCase();
    return matchesSaved && matchesFollowing && matchesLabel && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  return [...visible].sort((first, second) => {
    if (options.mode === "helpful") return second.helpful - first.helpful;
    return Date.parse(second.createdAt) - Date.parse(first.createdAt);
  });
}

export function buildReturnNudges(input: {
  followedModelSet: Set<string>;
  followedTopicSet: Set<string>;
  garage: GarageVehicle[];
  posts: OwnerPost[];
  savedCount: number;
}): string[] {
  const followedPosts = input.posts.filter(
    (post) => input.followedModelSet.has(modelKeyFor(post.brand, post.model)) || input.followedTopicSet.has(post.label),
  );
  const latestFollowed = followedPosts[0];
  const serviceSoon = input.garage.find((vehicle) => vehicle.odometerKm > 0 && vehicle.odometerKm % 10000 >= 8500);

  return [
    latestFollowed ? `New ${latestFollowed.label.toLowerCase()} surfaced for ${latestFollowed.brand} ${latestFollowed.model}.` : null,
    input.savedCount ? `${input.savedCount} saved note${input.savedCount === 1 ? "" : "s"} waiting in your garage shelf.` : null,
    serviceSoon ? `${serviceSoon.nickname || serviceSoon.model} is close to the next 10k km service checkpoint.` : null,
  ].filter((nudge): nudge is string => Boolean(nudge));
}

export function buildStarterRouteProgress(input: {
  follows: FollowState;
  garage: GarageVehicle[];
  profile: Pick<Profile, "city" | "displayName">;
  routes: StarterRoute[];
  savedCount: number;
  shortlistCount: number;
}): StarterRouteProgress[] {
  const completedById: Record<StarterRoute["id"], boolean> = {
    follow: input.follows.models.length + input.follows.topics.length > 0,
    garage: input.garage.length > 0,
    profile: Boolean(input.profile.displayName.trim() && input.profile.city.trim()),
    save: input.savedCount + input.shortlistCount > 0,
  };

  return input.routes.map((route) => ({
    ...route,
    complete: completedById[route.id],
  }));
}

export function buildConnectionStatusCopy(isOnline: boolean): ConnectionStatusCopy {
  if (isOnline) {
    return {
      detail: "Online for sharing, deploy checks, and future hosted sync. Local garage work still saves in this browser.",
      label: "Online",
      tone: "online",
    };
  }

  return {
    detail: "Offline mode: posts, garage notes, backups, and feedback still work locally. Sharing and future hosted sync can wait.",
    label: "Offline",
    tone: "offline",
  };
}

export function buildQaSessionSummary(items: QaSessionItem[], checkedIds: Set<string>): QaSessionSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildResponsiveQaSummary(items: ResponsiveQaItem[], checkedIds: Set<string>): ResponsiveQaSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildProductionLaunchSummary(
  items: ProductionLaunchItem[],
  checkedIds: Set<string>,
): ProductionLaunchSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildProductionOpsSummary(items: ProductionOpsItem[], checkedIds: Set<string>): ProductionOpsSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildPrivacyReadinessSummary(items: PrivacyReadinessItem[]): PrivacyReadinessSummary {
  return items.reduce<PrivacyReadinessSummary>(
    (summary, item) => ({
      ...summary,
      [item.stance]: summary[item.stance] + 1,
    }),
    {
      "Deletion baseline": 0,
      "Not collected": 0,
      "Stored for MVP": 0,
    },
  );
}

export function buildTesterRunSummary(runs: TesterRun[]): TesterRunSummary {
  return {
    blocked: runs.filter((run) => run.outcome === "Blocked").length,
    confusing: runs.filter((run) => run.outcome === "Confusing").length,
    openFriction: runs.filter((run) => run.outcome !== "Useful").slice(0, 5),
    total: runs.length,
    useful: runs.filter((run) => run.outcome === "Useful").length,
  };
}

export function buildHostedApiReadinessSummary(items: HostedApiReadinessItem[]): HostedApiReadinessSummary {
  return {
    beta: items.filter((item) => item.priority === "Beta").length,
    later: items.filter((item) => item.priority === "Later").length,
    launchBlockers: items.filter((item) => item.priority === "Launch blocker").length,
    serviceCenterBoundaries: items.filter((item) => item.serviceCenterBoundary).length,
  };
}

export function buildQaHandoffMarkdown(input: QaHandoffInput): string {
  const feedbackTotal = Object.values(input.feedbackSummary).reduce((total, count) => total + count, 0);
  const remainingQa = input.qaSummary.remaining.map((item) => `- ${item.label}`).join("\n") || "- None";
  const remainingResponsiveQa =
    input.responsiveQaSummary.remaining.map((item) => `- ${item.breakpoint} / ${item.surface}: ${item.label}`).join("\n") ||
    "- None";
  const launchBlockers = input.launchSummary.blocked.map((item) => `- ${item.label}: ${item.detail}`).join("\n") || "- None";
  const productionLaunchRemaining =
    input.productionLaunchSummary.remaining.map((item) => `- ${item.label}: ${item.detail}`).join("\n") || "- None";
  const productionOpsRemaining =
    input.productionOpsSummary.remaining.map((item) => `- ${item.label}: ${item.detail}`).join("\n") || "- None";
  const testerFriction =
    input.testerRunSummary.openFriction
      .map((run) => `- ${run.outcome} / ${run.nextLoopStage}: ${run.scenario} — ${run.friction}`)
      .join("\n") || "- None";
  const loopRouting = Object.entries(input.feedbackLoopSummary)
    .map(([stage, count]) => `- ${stage}: ${count}`)
    .join("\n");

  return [
    "# Autoflex QA handoff",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Tester identity",
    "",
    `Name: ${input.profile.displayName.trim() || "Anonymous garage member"}`,
    `City: ${input.profile.city.trim() || "Not set"}`,
    `Role: ${input.profile.garageRole}`,
    "",
    "## QA session",
    "",
    `Checked: ${input.qaSummary.checked}/${input.qaSummary.total}`,
    "",
    "Remaining smoke checks:",
    remainingQa,
    "",
    "## Responsive QA",
    "",
    `Checked: ${input.responsiveQaSummary.checked}/${input.responsiveQaSummary.total}`,
    "",
    "Remaining responsive checks:",
    remainingResponsiveQa,
    "",
    "## Launch readiness",
    "",
    `Ready: ${input.launchSummary.ready}/${input.launchSummary.total}`,
    `Production URL: ${input.productionUrl.trim() || "Not set"}`,
    "",
    "Open blockers:",
    launchBlockers,
    "",
    "Production launch checks:",
    `Checked: ${input.productionLaunchSummary.checked}/${input.productionLaunchSummary.total}`,
    "",
    "Remaining production checks:",
    productionLaunchRemaining,
    "",
    "Production operations:",
    `Checked: ${input.productionOpsSummary.checked}/${input.productionOpsSummary.total}`,
    "",
    "Remaining operations checks:",
    productionOpsRemaining,
    "",
    "## Feedback triage",
    "",
    `Total tester notes: ${feedbackTotal}`,
    `New: ${input.feedbackSummary.New}`,
    `Reviewing: ${input.feedbackSummary.Reviewing}`,
    `Planned: ${input.feedbackSummary.Planned}`,
    `Shipped: ${input.feedbackSummary.Shipped}`,
    "",
    "Loop routing:",
    loopRouting,
    "",
    "## Real-user test runs",
    "",
    `Runs: ${input.testerRunSummary.total}`,
    `Useful: ${input.testerRunSummary.useful}`,
    `Confusing: ${input.testerRunSummary.confusing}`,
    `Blocked: ${input.testerRunSummary.blocked}`,
    "",
    "Open tester friction:",
    testerFriction,
    "",
    "## Hosted API readiness",
    "",
    `Launch blockers: ${input.hostedApiSummary.launchBlockers}`,
    `Beta items: ${input.hostedApiSummary.beta}`,
    `Later items: ${input.hostedApiSummary.later}`,
    `Service-center boundaries: ${input.hostedApiSummary.serviceCenterBoundaries}`,
    "",
    "## Privacy readiness",
    "",
    `Stored for MVP: ${input.privacySummary["Stored for MVP"]}`,
    `Not collected: ${input.privacySummary["Not collected"]}`,
    `Deletion baseline: ${input.privacySummary["Deletion baseline"]}`,
    "",
    "## Service-center boundary",
    "",
    "Service-center integration remains outside this MVP loop until the owning team provides its contract.",
  ].join("\n");
}

export function buildFeedbackLoopSummary(feedback: FeedbackNote[]): FeedbackLoopSummary {
  return feedback.reduce<FeedbackLoopSummary>(
    (summary, note) => ({
      ...summary,
      [note.loopStage]: summary[note.loopStage] + 1,
    }),
    {
      "Backend engineer": 0,
      Designer: 0,
      "Frontend engineer": 0,
      "Product owner": 0,
      "Real user": 0,
      "Tested / QA": 0,
    },
  );
}

export function buildNotificationPreview(input: {
  follows: FollowState;
  posts: OwnerPost[];
  preference: SubscriptionPreference;
}): string[] {
  if (!input.preference.emailDigest && !input.preference.browserAlerts) {
    return ["Notifications are paused. Follows still shape your feed."];
  }

  const followedModelSet = new Set(input.follows.models);
  const followedTopicSet = new Set(input.follows.topics);
  const followedPosts = input.posts.filter(
    (post) => followedModelSet.has(modelKeyFor(post.brand, post.model)) || followedTopicSet.has(post.label),
  );
  const channel = input.preference.browserAlerts ? "Browser alert" : "Weekly digest";

  if (!followedPosts.length) {
    return [`${channel}: follow a model or topic to start getting useful ownership updates.`];
  }

  return followedPosts.slice(0, 3).map((post) => `${channel}: ${post.brand} ${post.model} has a new ${post.label.toLowerCase()}.`);
}

export function buildGarageInsights(garage: GarageVehicle[], timeline: TimelineEntry[], posts: OwnerPost[]): GarageInsight[] {
  return garage.flatMap((vehicle) => {
    const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id);
    const totalSpend = entries.reduce((total, entry) => total + entry.amount, 0);
    const matchingPosts = posts.filter(
      (post) => modelKeyFor(post.brand, post.model) === modelKeyFor(vehicle.brand, vehicle.model),
    );
    const nextServiceKm = Math.ceil((vehicle.odometerKm + 1) / 10000) * 10000;

    return [
      {
        id: `${vehicle.id}-service`,
        title: `${vehicle.nickname || vehicle.model}: next checkpoint`,
        detail: `${Math.max(0, nextServiceKm - vehicle.odometerKm).toLocaleString("en-IN")} km to the next 10k service marker.`,
        tone: "service" as const,
      },
      {
        id: `${vehicle.id}-cost`,
        title: `${vehicle.nickname || vehicle.model}: logged spend`,
        detail: totalSpend
          ? `${formatMoney(totalSpend)} captured across ${entries.length} timeline note${entries.length === 1 ? "" : "s"}.`
          : "No spend logged yet. Add service, repair, tyre, insurance, or fuel notes.",
        tone: "cost" as const,
      },
      {
        id: `${vehicle.id}-community`,
        title: `${vehicle.model}: community context`,
        detail: `${matchingPosts.length} related ownership note${matchingPosts.length === 1 ? "" : "s"} available in model notebooks.`,
        tone: "community" as const,
      },
    ];
  });
}

export function buildGarageCostLedger(garage: GarageVehicle[], timeline: TimelineEntry[]): GarageCostLedger[] {
  return garage
    .map((vehicle) => {
      const entries = timeline
        .filter((entry) => entry.vehicleId === vehicle.id)
        .sort((first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn));
      const totalSpend = entries.reduce((total, entry) => total + entry.amount, 0);
      const highestLoggedOdometerKm = entries.reduce((highest, entry) => Math.max(highest, entry.odometerKm), vehicle.odometerKm);
      const usableKm = Math.max(vehicle.odometerKm, highestLoggedOdometerKm);

      return {
        costPerKm: usableKm > 0 && totalSpend > 0 ? totalSpend / usableKm : null,
        entryCount: entries.length,
        highestLoggedOdometerKm,
        latestEntry: entries[0] ?? null,
        totalSpend,
        vehicle,
      };
    })
    .sort((first, second) => second.totalSpend - first.totalSpend || first.vehicle.nickname.localeCompare(second.vehicle.nickname));
}

export function buildGarageReminders(garage: GarageVehicle[], timeline: TimelineEntry[], today = new Date()): GarageReminder[] {
  return garage.flatMap((vehicle) => {
    const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id);
    const vehicleName = vehicle.nickname || `${vehicle.brand} ${vehicle.model}`;
    const nextServiceKm = Math.ceil((vehicle.odometerKm + 1) / 10000) * 10000;
    const kmToService = Math.max(0, nextServiceKm - vehicle.odometerKm);
    const latestInsurance = latestEntryOfKind(entries, "Insurance");
    const latestTyres = latestEntryOfKind(entries, "Tyres");

    return [
      kmToService <= 1500
        ? {
            detail: `${kmToService.toLocaleString("en-IN")} km left before the ${nextServiceKm.toLocaleString("en-IN")} km checkpoint.`,
            id: `${vehicle.id}-service-reminder`,
            title: "Plan the next service visit",
            urgency: kmToService <= 500 ? ("Soon" as const) : ("Plan" as const),
            vehicleId: vehicle.id,
            vehicleName,
          }
        : null,
      latestInsurance
        ? insuranceReminder(vehicle, vehicleName, latestInsurance, today)
        : {
            detail: "No insurance note is logged yet. Add renewal date, premium, and claim details when available.",
            id: `${vehicle.id}-insurance-missing`,
            title: "Log insurance renewal details",
            urgency: "Plan" as const,
            vehicleId: vehicle.id,
            vehicleName,
          },
      latestTyres && vehicle.odometerKm - latestTyres.odometerKm >= 35000
        ? {
            detail: `${(vehicle.odometerKm - latestTyres.odometerKm).toLocaleString("en-IN")} km since the last tyre note.`,
            id: `${vehicle.id}-tyre-watch`,
            title: "Inspect tyre age and wear",
            urgency: "Watch" as const,
            vehicleId: vehicle.id,
            vehicleName,
          }
        : null,
    ].filter((reminder): reminder is GarageReminder => Boolean(reminder));
  });
}

function latestEntryOfKind(entries: TimelineEntry[], kind: TimelineEntry["kind"]): TimelineEntry | null {
  return (
    entries
      .filter((entry) => entry.kind === kind)
      .sort((first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn))[0] ?? null
  );
}

function insuranceReminder(
  vehicle: GarageVehicle,
  vehicleName: string,
  latestInsurance: TimelineEntry,
  today: Date,
): GarageReminder | null {
  const renewalDate = new Date(latestInsurance.happenedOn);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const daysToRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / 86_400_000);

  if (daysToRenewal > 45) return null;

  return {
    detail:
      daysToRenewal >= 0
        ? `${daysToRenewal} day${daysToRenewal === 1 ? "" : "s"} left before the logged insurance renewal window.`
        : `${Math.abs(daysToRenewal)} day${daysToRenewal === -1 ? "" : "s"} past the logged insurance renewal window.`,
    id: `${vehicle.id}-insurance-renewal`,
    title: "Review insurance renewal",
    urgency: daysToRenewal <= 15 ? "Soon" : "Plan",
    vehicleId: vehicle.id,
    vehicleName,
  };
}

export function buildModerationSummary(reports: ReportRecord[]): ModerationSummary {
  const openReports = reports.filter((report) => report.status === "Open");
  const reportCounts = openReports.reduce<Map<string, number>>((counts, report) => {
    counts.set(report.postId, (counts.get(report.postId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return {
    openReports: openReports.length,
    dismissedReports: reports.filter((report) => report.status === "Dismissed").length,
    removedReports: reports.filter((report) => report.status === "Removed").length,
    riskyPostIds: [...reportCounts.entries()].filter(([, count]) => count >= 2).map(([postId]) => postId),
  };
}

export function buildFeedbackTriageSummary(feedback: FeedbackNote[]): FeedbackTriageSummary {
  return feedback.reduce<FeedbackTriageSummary>(
    (summary, note) => ({
      ...summary,
      [note.status]: summary[note.status] + 1,
    }),
    {
      New: 0,
      Planned: 0,
      Reviewing: 0,
      Shipped: 0,
    },
  );
}

export function buildLaunchReadinessSummary(items: LaunchReadinessItem[]): LaunchReadinessSummary {
  const blocked = items.filter((item) => !item.ready);

  return {
    blocked,
    ready: items.length - blocked.length,
    total: items.length,
  };
}

export function buildPostSharePayload(post: OwnerPost): SharePayload {
  return {
    title: `${post.brand} ${post.model}: ${post.title}`,
    text: [
      `${post.title}`,
      `${post.label} for ${post.brand} ${post.model}${post.variant ? ` ${post.variant}` : ""}`,
      `${post.city || "City not shared"} · ${post.odometerKm.toLocaleString("en-IN")} km · ${post.helpful} helpful`,
      post.body.slice(0, 180),
    ].join("\n"),
  };
}

export function buildModelSharePayload(notebook: ModelNotebook): SharePayload {
  const labels = [...new Set(notebook.posts.map((post) => post.label))].join(", ");
  return {
    title: `${notebook.brand} ${notebook.model} owner notebook`,
    text: `${notebook.brand} ${notebook.model} has ${notebook.posts.length} Autoflex owner note${
      notebook.posts.length === 1 ? "" : "s"
    }: ${labels || "owner notes"}.`,
  };
}

export function buildGarageExportMarkdown(garage: GarageVehicle[], timeline: TimelineEntry[]): string {
  if (!garage.length) return "# Autoflex garage\n\nNo vehicles saved yet.";

  return [
    "# Autoflex garage export",
    "",
    ...garage.flatMap((vehicle) => {
      const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id);
      return [
        `## ${vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}`,
        "",
        `- Vehicle: ${vehicle.brand} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`,
        `- City: ${vehicle.city || "Not shared"}`,
        `- Odometer: ${vehicle.odometerKm.toLocaleString("en-IN")} km`,
        `- Purchase month: ${vehicle.purchaseMonth || "Not shared"}`,
        "",
        "### Timeline",
        "",
        ...(entries.length
          ? entries.map(
              (entry) =>
                `- ${entry.happenedOn}: ${entry.kind} — ${entry.title} (${formatMoney(entry.amount)}, ${entry.odometerKm.toLocaleString(
                  "en-IN",
                )} km). ${entry.note}`,
            )
          : ["- No timeline notes yet."]),
        "",
      ];
    }),
  ].join("\n");
}

export function buildShortlistComparisons(shortlist: ShortlistItem[], posts: OwnerPost[]): ShortlistComparison[] {
  return shortlist.map((item) => {
    const relatedPosts = posts.filter((post) => modelKeyFor(post.brand, post.model) === modelKeyFor(item.brand, item.model));
    const knownIssues = relatedPosts.filter((post) => post.label === "Known issue").length;
    const fixes = relatedPosts.filter((post) => post.label === "Fix").length;
    const ownerReviews = relatedPosts.filter((post) => post.label === "Review").length;
    const confidence = relatedPosts.length >= 3 ? "High" : relatedPosts.length >= 1 ? "Medium" : "Low";

    return {
      item,
      relatedNotes: relatedPosts.length,
      knownIssues,
      fixes,
      ownerReviews,
      confidence,
    };
  });
}

export function buildInspectionChecklists(shortlist: ShortlistItem[], posts: OwnerPost[]): InspectionChecklist[] {
  return shortlist.map((item) => {
    const relatedPosts = posts.filter((post) => modelKeyFor(post.brand, post.model) === modelKeyFor(item.brand, item.model));
    const knownIssue = relatedPosts.find((post) => post.label === "Known issue");
    const fix = relatedPosts.find((post) => post.label === "Fix");
    const costNote = relatedPosts.find((post) => post.label === "Cost note");
    const review = relatedPosts.find((post) => post.label === "Review");
    const highestOdometer = relatedPosts.reduce((highest, post) => Math.max(highest, post.odometerKm), 0);

    const checklist = [
      knownIssue
        ? {
            detail: `Owner note: “${knownIssue.title}”`,
            id: `${item.id}-known-issue`,
            priority: "High" as const,
            title: `Inspect known ${knownIssue.topic.toLowerCase()} concern`,
          }
        : null,
      fix
        ? {
            detail: `Ask whether this fix was attempted: “${fix.title}”`,
            id: `${item.id}-fix`,
            priority: "High" as const,
            title: "Verify common fix history",
          }
        : null,
      costNote
        ? {
            detail: `Use this cost reference while negotiating: “${costNote.title}”`,
            id: `${item.id}-cost`,
            priority: "Medium" as const,
            title: "Compare bill and quote expectations",
          }
        : null,
      review
        ? {
            detail: `Cross-check daily usability with: “${review.title}”`,
            id: `${item.id}-review`,
            priority: "Medium" as const,
            title: "Validate ownership fit",
          }
        : null,
      highestOdometer
        ? {
            detail: `Community notes reach ${highestOdometer.toLocaleString("en-IN")} km; compare the seller car against that stage.`,
            id: `${item.id}-odometer`,
            priority: "Low" as const,
            title: "Match odometer-stage expectations",
          }
        : null,
      {
        detail: "Carry a short test-drive route, inspect tyres, service records, insurance claims, and cold-start behavior.",
        id: `${item.id}-baseline`,
        priority: relatedPosts.length ? ("Low" as const) : ("High" as const),
        title: relatedPosts.length ? "Run the baseline used-car inspection" : "Start with a baseline inspection checklist",
      },
    ].filter((entry): entry is InspectionChecklistItem => Boolean(entry));

    return {
      checklist: checklist.slice(0, 5),
      item,
    };
  });
}

export function buildCityCircles(posts: OwnerPost[], garage: GarageVehicle[]): CityCircle[] {
  const cityNames = new Set(
    [...posts.map((post) => post.city), ...garage.map((vehicle) => vehicle.city)]
      .map((city) => city.trim())
      .filter(Boolean),
  );

  return [...cityNames]
    .map((city) => {
      const cityPosts = posts.filter((post) => post.city.trim().toLowerCase() === city.toLowerCase());
      const cityGarage = garage.filter((vehicle) => vehicle.city.trim().toLowerCase() === city.toLowerCase());
      const topBrands = topValues(cityPosts.map((post) => post.brand), 3);
      const hotTopics = topValues(cityPosts.map((post) => post.label), 3) as KnowledgeLabel[];
      const activityScore = cityPosts.length + cityGarage.length;
      const localSignal: CityCircle["localSignal"] = activityScore >= 4 ? "Hot" : activityScore >= 2 ? "Active" : "Quiet";

      return {
        city,
        garageVehicles: cityGarage,
        hotTopics,
        localSignal,
        posts: cityPosts,
        topBrands,
      };
    })
    .sort((first, second) => second.posts.length + second.garageVehicles.length - (first.posts.length + first.garageVehicles.length));
}

export function buildOwnershipPlaybooks(posts: OwnerPost[]): OwnershipPlaybook[] {
  return groupByModel(posts)
    .map((notebook) => {
      const sortedPosts = [...notebook.posts].sort((first, second) => second.helpful - first.helpful);
      const labels = new Set(notebook.posts.map((post) => post.label));
      const highestOdometer = Math.max(...notebook.posts.map((post) => post.odometerKm));
      const cities = topValues(notebook.posts.map((post) => post.city).filter(Boolean), 2);
      const confidence: OwnershipPlaybook["confidence"] =
        notebook.posts.length >= 4 ? "Strong pattern" : notebook.posts.length >= 2 ? "Useful base" : "Early signal";

      const ownerSignals = [
        labels.has("Fix") ? "Confirmed fixes are available before the owner needs a dealer second opinion." : null,
        labels.has("Cost note") ? "Cost notes are present, so running expenses can be compared with less guesswork." : null,
        labels.has("Travelogue") ? "Road-trip reports add real-world comfort, tyre, fuel, and packing context." : null,
        highestOdometer ? `Community evidence reaches ${highestOdometer.toLocaleString("en-IN")} km.` : null,
      ].filter((signal): signal is string => Boolean(signal));

      const buyerChecks = [
        labels.has("Known issue") ? "Read known issues first and test those symptoms during inspection." : null,
        labels.has("Fix") ? "Ask whether the common fix has already been done and keep the bill handy." : null,
        cities.length ? `Compare notes from ${cities.join(" and ")} before assuming one city’s usage pattern applies everywhere.` : null,
        sortedPosts[0] ? `Start with “${sortedPosts[0].title}” because owners marked it most useful.` : null,
      ].filter((check): check is string => Boolean(check));

      return {
        brand: notebook.brand,
        buyerChecks: buyerChecks.slice(0, 3),
        confidence,
        evidenceCount: notebook.posts.length,
        headline: summarizePlaybook(notebook, labels),
        key: notebook.key,
        model: notebook.model,
        ownerSignals: ownerSignals.slice(0, 3),
      };
    })
    .sort((first, second) => second.evidenceCount - first.evidenceCount || first.key.localeCompare(second.key));
}

export function assessPostQuality(post: PostQualityInput): PostQualityReport {
  const body = post.body.trim().toLowerCase();
  const checks = [
    {
      passed: Boolean(post.variant.trim()),
      strength: "Variant is included, so advice maps to the right trim/engine.",
      prompt: "Add variant, fuel, gearbox, or trim so readers do not overgeneralize.",
    },
    {
      passed: Boolean(post.city.trim()),
      strength: "City is included, which helps readers judge traffic, climate, and road context.",
      prompt: "Add city or route context because usage pattern changes the ownership story.",
    },
    {
      passed: post.odometerKm > 0,
      strength: "Odometer is included, so wear-and-tear claims have a timeline.",
      prompt: "Add odometer reading to anchor the issue, review, or cost note.",
    },
    {
      passed: body.length >= 180,
      strength: "The note has enough depth for a future owner to learn from it.",
      prompt: "Add symptoms, decision path, failed attempts, bill details, or what changed after the fix.",
    },
    {
      passed: /(₹|rs\.?|inr|cost|paid|bill|labou?r|part|quote)/i.test(post.body),
      strength: "Cost or bill language is present, making the note more actionable.",
      prompt: "Mention cost, bill split, quote, or whether no money was spent.",
    },
    {
      passed: /(fixed|resolved|worked|held|failed|recommend|avoid|would|wouldn't|inspection|check)/i.test(post.body),
      strength: "Outcome language is present, so readers know what to do next.",
      prompt: "Add the outcome: what worked, what failed, what to check, or what you would do differently.",
    },
  ];

  const strengths = checks.filter((check) => check.passed).map((check) => check.strength);
  const missingPrompts = checks.filter((check) => !check.passed).map((check) => check.prompt);
  const score = strengths.length;
  const grade: PostQualityReport["grade"] = score >= 5 ? "Garage-grade" : score >= 3 ? "Useful draft" : "Needs context";

  return {
    grade,
    maxScore: checks.length,
    missingPrompts,
    score,
    strengths,
  };
}

function summarizePlaybook(notebook: ModelNotebook, labels: Set<KnowledgeLabel>): string {
  if (labels.has("Known issue") && labels.has("Fix")) {
    return "Known issues and workable fixes are both visible, making this a strong inspection-first notebook.";
  }

  if (labels.has("Review")) {
    return "Owner reviews are available, so buyers can judge daily usability beyond brochure strengths.";
  }

  if (labels.has("Travelogue")) {
    return "Long-drive experience is documented, useful for touring comfort and preparation checks.";
  }

  return `${notebook.brand} ${notebook.model} has early owner evidence ready for deeper community follow-up.`;
}

function topValues(values: string[], limit: number): string[] {
  const counts = values.reduce<Map<string, number>>((accumulator, value) => {
    accumulator.set(value, (accumulator.get(value) ?? 0) + 1);
    return accumulator;
  }, new Map<string, number>());

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

export function formatMoney(amount: number, maximumFractionDigits = 0): string {
  if (!amount) return "No cost logged";
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits, style: "currency" }).format(amount);
}
