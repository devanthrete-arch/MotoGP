import { type FollowState, type OwnerPost } from "../../../core/entities";
import { modelKeyFor, slugifyCity } from "../../../core/identity";
import { type GarageReminder } from "../../../core/projections";

export type SubscriptionPreference = {
  emailDigest: boolean;
  browserAlerts: boolean;
  quietHours: boolean;
};

export const defaultSubscriptionPreference: SubscriptionPreference = {
  emailDigest: true,
  browserAlerts: false,
  quietHours: true,
};

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

/**
 * Locally-declared copies of the hosted notification unions.
 *
 * `insights.ts` cannot import from `src/hosted/*` (the hosted mappers import
 * this module), so the literal unions are restated here. They are structurally
 * identical to `HostedNotificationKind` / `HostedNotificationChannel`, which is
 * what `queueHostedNotifications` needs.
 */
export type NotificationJobKind = "Digest" | "Model alert" | "Topic alert" | "City alert" | "Reminder" | "Moderation";
export type NotificationJobChannel = "Email digest" | "Browser alert" | "In-app";

export type NotificationJobDraft = {
  kind: NotificationJobKind;
  channel: NotificationJobChannel;
  payload: Record<string, unknown>;
  scheduledFor: string;
};

export type NotificationJobInput = {
  cityFollows?: string[];
  follows: FollowState;
  now?: Date;
  posts: OwnerPost[];
  preference: SubscriptionPreference;
  reminders?: GarageReminder[];
};

/** The channel a queued job should use, given the user's local preferences. */
export function notificationChannelFor(preference: SubscriptionPreference): NotificationJobChannel {
  if (preference.emailDigest) return "Email digest";
  if (preference.browserAlerts) return "Browser alert";
  return "In-app";
}

/**
 * Real `notification_jobs` rows to queue for the signed-in user, replacing the
 * local-only digest preview. Returns `[]` when the user has paused every
 * channel, so a paused account never queues work.
 */
export function buildNotificationJobDrafts(input: NotificationJobInput): NotificationJobDraft[] {
  const preference = input.preference;
  if (!preference.emailDigest && !preference.browserAlerts) return [];

  const now = input.now ?? new Date();
  const scheduledFor = now.toISOString();
  const channel = notificationChannelFor(preference);
  const followedModelSet = new Set(input.follows.models);
  const followedTopicSet = new Set(input.follows.topics);
  const followedCities = (input.cityFollows ?? []).filter(Boolean);

  const modelDrafts = input.posts
    .filter((post) => followedModelSet.has(modelKeyFor(post.brand, post.model)))
    .slice(0, 3)
    .map<NotificationJobDraft>((post) => ({
      channel,
      kind: "Model alert",
      payload: {
        body: `${post.brand} ${post.model} has a new ${post.label.toLowerCase()}.`,
        model: modelKeyFor(post.brand, post.model),
        postId: post.id,
        title: post.title,
      },
      scheduledFor,
    }));

  const topicDrafts = [...followedTopicSet]
    .map((topic) => ({ posts: input.posts.filter((post) => post.label === topic), topic }))
    .filter((entry) => entry.posts.length > 0)
    .slice(0, 3)
    .map<NotificationJobDraft>((entry) => ({
      channel,
      kind: "Topic alert",
      payload: {
        body: `${entry.posts.length} new ${entry.topic.toLowerCase()} note${entry.posts.length === 1 ? "" : "s"} to read.`,
        noteCount: entry.posts.length,
        title: `${entry.topic} updates`,
        topic: entry.topic,
      },
      scheduledFor,
    }));

  const cityDrafts = followedCities.slice(0, 3).map<NotificationJobDraft>((citySlug) => {
    const cityPosts = input.posts.filter((post) => slugifyCity(post.city) === citySlug);
    return {
      channel,
      kind: "City alert",
      payload: {
        body: `${cityPosts.length} owner note${cityPosts.length === 1 ? "" : "s"} from this city circle.`,
        citySlug,
        noteCount: cityPosts.length,
        title: `${citySlug.replace(/-/g, " ")} circle`,
      },
      scheduledFor,
    };
  });

  const reminderDrafts = (input.reminders ?? [])
    .filter((reminder) => reminder.urgency !== "Watch")
    .slice(0, 5)
    .map<NotificationJobDraft>((reminder) => ({
      channel,
      kind: "Reminder",
      payload: {
        body: reminder.detail,
        reminderId: reminder.id,
        title: `${reminder.vehicleName}: ${reminder.title}`,
        urgency: reminder.urgency,
        vehicleId: reminder.vehicleId,
      },
      scheduledFor,
    }));

  const drafts = [...modelDrafts, ...topicDrafts, ...cityDrafts, ...reminderDrafts];

  if (!drafts.length && preference.emailDigest) {
    return [
      {
        channel,
        kind: "Digest",
        payload: {
          body: "Follow a car, topic or city to fill your next Autoflex digest.",
          title: "Your Autoflex digest",
        },
        scheduledFor,
      },
    ];
  }

  return drafts;
}
