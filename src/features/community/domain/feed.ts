import { type KnowledgeLabel, type OwnerPost } from "../../../core/entities";
import { modelKeyFor } from "../../../core/identity";

/** The four ways the community feed can be ordered/filtered. */
export type FeedMode = "latest" | "helpful" | "saved" | "following";

export function filterPostsByMode(
  posts: OwnerPost[],
  options: {
    followedModelSet: Set<string>;
    followedTopicSet: Set<string>;
    mode: FeedMode;
    query: string;
    /**
     * Hosted `ranking_score` per post id. When supplied and non-empty the
     * "Trending" mode orders by it; otherwise the local helpful-count sort is
     * used unchanged, so a signed-out or offline client behaves as before.
     */
    rankingScores?: Map<string, number>;
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

  const rankingScores = options.rankingScores;
  const useHostedRanking = options.mode === "helpful" && Boolean(rankingScores && rankingScores.size);

  return [...visible].sort((first, second) => {
    if (useHostedRanking && rankingScores) {
      const firstScore = rankingScores.get(first.id) ?? 0;
      const secondScore = rankingScores.get(second.id) ?? 0;
      if (secondScore !== firstScore) return secondScore - firstScore;
      if (second.helpful !== first.helpful) return second.helpful - first.helpful;
      return Date.parse(second.createdAt) - Date.parse(first.createdAt);
    }
    if (options.mode === "helpful") return second.helpful - first.helpful;
    return Date.parse(second.createdAt) - Date.parse(first.createdAt);
  });
}
