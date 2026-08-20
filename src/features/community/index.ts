/**
 * Public API of the `community` feature: owner posts, the feed, follows, moderation and notification drafting.
 *
 * Other features and the app composition root may only import from this
 * barrel. Everything under `community/domain`, `community/data`, `community/hooks` and
 * `community/ui` that is not re-exported here is internal to the feature.
 */

export { filterPostsByMode } from "./domain/feed";
export { buildModerationSummary } from "./domain/moderation";
export type { ModerationSummary } from "./domain/moderation";
export { buildNotificationJobDrafts, buildNotificationPreview, defaultSubscriptionPreference, notificationChannelFor } from "./domain/notifications";
export type { NotificationJobChannel, NotificationJobDraft, NotificationJobInput, NotificationJobKind, SubscriptionPreference } from "./domain/notifications";
export { buildModelSharePayload, buildPostSharePayload } from "./domain/sharePayload";
export type { SharePayload } from "./domain/sharePayload";
export { initialPostDraft } from "./domain/drafts";
export { useCommunityDerived } from "./hooks/useCommunityDerived";
export type { FeedMode } from "./domain/feed";
