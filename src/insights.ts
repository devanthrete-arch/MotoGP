import type {
  FollowState,
  GarageVehicle,
  KnowledgeLabel,
  ModelNotebook,
  OwnerPost,
  ReportRecord,
  ShortlistItem,
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

export type ModerationSummary = {
  openReports: number;
  dismissedReports: number;
  removedReports: number;
  riskyPostIds: string[];
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

export type CityCircle = {
  city: string;
  posts: OwnerPost[];
  garageVehicles: GarageVehicle[];
  topBrands: string[];
  hotTopics: KnowledgeLabel[];
  localSignal: "Quiet" | "Active" | "Hot";
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

export function formatMoney(amount: number): string {
  if (!amount) return "No cost logged";
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 0, style: "currency" }).format(amount);
}
