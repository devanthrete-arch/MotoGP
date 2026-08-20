import { useMemo } from "react";
import {
  assessPostQuality,
  groupByModel,
  type DraftPost,
  type FollowState,
  type KnowledgeLabel,
  type OwnerPost,
  type ReportRecord,
  type SubscriptionSettings,
} from "../../../core";
import { type HostedPostQuality } from "../data/communityRepository";
import { filterPostsByMode, type FeedMode } from "../domain/feed";
import { buildModerationSummary } from "../domain/moderation";
import { buildNotificationPreview } from "../domain/notifications";

/**
 * Everything the community surfaces read but never write: the feed projection,
 * follow sets, hosted ranking/quality lookups, the moderation queue summary and
 * the two live post-quality reports.
 *
 * Dependencies arrive as an explicit argument rather than being read from a
 * context, which is what lets the feed logic be unit-tested without React and
 * keeps the composition root the only place that owns state.
 */
export function useCommunityDerived({
  draft,
  follows,
  hostedQuality,
  mode,
  posts,
  query,
  reports,
  saved,
  selectedLabel,
  selectedPost,
  subscriptionSettings,
}: {
  draft: DraftPost;
  follows: FollowState;
  hostedQuality: HostedPostQuality[];
  mode: FeedMode;
  posts: OwnerPost[];
  query: string;
  reports: ReportRecord[];
  saved: Set<string>;
  selectedLabel: KnowledgeLabel | "All";
  selectedPost: OwnerPost | null;
  subscriptionSettings: SubscriptionSettings;
}) {
  const notebooks = useMemo(() => groupByModel(posts), [posts]);
  const followedModelSet = useMemo(() => new Set(follows.models), [follows.models]);
  const followedTopicSet = useMemo(() => new Set(follows.topics), [follows.topics]);

  /** postId -> hosted `ranking_score`. Empty offline, which keeps the local sort. */
  const hostedRankingScores = useMemo(
    () => new Map(hostedQuality.map((quality) => [quality.postId, quality.rankingScore])),
    [hostedQuality],
  );

  const hostedQualityByPostId = useMemo(
    () => new Map(hostedQuality.map((quality) => [quality.postId, quality])),
    [hostedQuality],
  );

  const filteredPosts = useMemo(
    () =>
      filterPostsByMode(posts, {
        followedModelSet,
        followedTopicSet,
        mode,
        query,
        rankingScores: hostedRankingScores,
        saved,
        selectedLabel,
      }),
    [followedModelSet, followedTopicSet, hostedRankingScores, mode, posts, query, saved, selectedLabel],
  );

  const feedRankingSource: "hosted" | "local" = hostedRankingScores.size ? "hosted" : "local";

  const notificationPreview = useMemo(
    () => buildNotificationPreview({ follows, posts, preference: subscriptionSettings }),
    [follows, posts, subscriptionSettings],
  );

  const moderationSummary = useMemo(() => buildModerationSummary(reports), [reports]);

  const draftQuality = useMemo(() => assessPostQuality(draft), [draft]);
  const selectedPostQuality = useMemo(() => (selectedPost ? assessPostQuality(selectedPost) : null), [selectedPost]);

  return {
    draftQuality,
    feedRankingSource,
    filteredPosts,
    followedModelSet,
    followedTopicSet,
    hostedQualityByPostId,
    hostedRankingScores,
    moderationSummary,
    notebooks,
    notificationPreview,
    selectedPostQuality,
  };
}
