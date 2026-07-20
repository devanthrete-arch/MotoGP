import type { FollowState, GarageVehicle, KnowledgeLabel, ModelNotebook, OwnerPost, TimelineEntry } from "./domain";

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

export function formatMoney(amount: number): string {
  if (!amount) return "No cost logged";
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 0, style: "currency" }).format(amount);
}
