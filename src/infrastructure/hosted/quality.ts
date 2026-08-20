import type { OwnerPost } from "../../core/entities";
import { PUBLIC_LIST_LIMIT } from "./kernel/limits";
import type { PostQualityReport } from "../../insights";
import { assessPostQuality } from "../../insights";
import { CACHE_TTL, invalidateHostedNamespace, publicKey, readThroughCache } from "./kernel/cache";
import { asAmount, asCount, asIsoTimestamp, asOneOf, asStringList, asText } from "./kernel/coerce";
import { type HostedClient, runHosted, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { Insert, PostQualityScoreRow } from "../supabase/tables";

export const qualityGrades = ["Needs context", "Useful draft", "Garage-grade"] as const;

export type HostedQualityGrade = (typeof qualityGrades)[number];

/** `PostQualityReport` plus the hosted ranking columns the feed can order on. */
export type HostedPostQuality = PostQualityReport & {
  postId: string;
  rankingScore: number;
  computedAt: string;
};

export const emptyQualityReport: PostQualityReport = {
  grade: "Needs context",
  maxScore: 0,
  missingPrompts: [],
  score: 0,
  strengths: [],
};

/**
 * Deterministic ranking score: quality carries the signal, helpful/fix counts
 * add social proof, and recency decays over roughly a month.
 */
export const rankingScoreFor = (post: OwnerPost, report: PostQualityReport, now = Date.now()): number => {
  const quality = report.maxScore > 0 ? report.score / report.maxScore : 0;
  const social = Math.log10(1 + Math.max(0, post.helpful) + Math.max(0, post.fixesConfirmed) * 2);
  const ageDays = Math.max(0, (now - Date.parse(post.createdAt || "")) / 86_400_000);
  const recency = Number.isFinite(ageDays) ? 1 / (1 + ageDays / 30) : 0;
  const score = quality * 6 + social * 2 + recency * 2;
  return Number.isFinite(score) ? Math.round(score * 10_000) / 10_000 : 0;
};

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const qualityRowToLocal = (row: PostQualityScoreRow): HostedPostQuality => ({
  computedAt: asIsoTimestamp(row.computed_at),
  grade: asOneOf<HostedQualityGrade>(row.grade, qualityGrades, "Needs context"),
  maxScore: asCount(row.max_score),
  missingPrompts: asStringList(row.missing_prompts),
  postId: asText(row.post_id),
  rankingScore: asAmount(row.ranking_score),
  score: asCount(row.score),
  strengths: asStringList(row.strengths),
});

export const qualityRowToReport = (row: PostQualityScoreRow): PostQualityReport => {
  const { computedAt: _computedAt, postId: _postId, rankingScore: _rankingScore, ...report } = qualityRowToLocal(row);
  return report;
};

export const qualityToRow = (userId: string, quality: HostedPostQuality): Insert<"post_quality_scores"> => ({
  components: {
    missingPromptCount: quality.missingPrompts.length,
    strengthCount: quality.strengths.length,
  },
  computed_at: asIsoTimestamp(quality.computedAt),
  grade: asOneOf<HostedQualityGrade>(quality.grade, qualityGrades, "Needs context"),
  max_score: asCount(quality.maxScore),
  missing_prompts: asStringList(quality.missingPrompts),
  post_id: asText(quality.postId),
  ranking_score: asAmount(quality.rankingScore),
  score: asCount(quality.score),
  strengths: asStringList(quality.strengths),
  user_id: userId,
});

/** Local post → the hosted quality/ranking record, using the app's own assessor. */
export const postToQuality = (post: OwnerPost, now = Date.now()): HostedPostQuality => {
  const report = assessPostQuality(post);
  return {
    ...report,
    computedAt: new Date(now).toISOString(),
    postId: post.id,
    rankingScore: rankingScoreFor(post, report, now),
  };
};

export const qualityIndex = (scores: HostedPostQuality[]): Map<string, HostedPostQuality> =>
  new Map(scores.map((score) => [score.postId, score]));

/** Highest ranking score first, falling back to recency for ties. */
export const rankPosts = (posts: OwnerPost[], scores: Map<string, HostedPostQuality>): OwnerPost[] =>
  [...posts].sort((first, second) => {
    const firstScore = scores.get(first.id)?.rankingScore ?? 0;
    const secondScore = scores.get(second.id)?.rankingScore ?? 0;
    if (secondScore !== firstScore) return secondScore - firstScore;
    return Date.parse(second.createdAt) - Date.parse(first.createdAt);
  });

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectQualityRows = async (client: HostedClient): Promise<PostQualityScoreRow[]> =>
  unwrap(
    await client
      .from("post_quality_scores")
      .select("*")
      .order("ranking_score", { ascending: false })
      .limit(PUBLIC_LIST_LIMIT),
    [],
  );

/** Public read: quality scores are anon-readable so the feed can rank signed-out. */
export const listHostedPostQuality = (fallback: HostedPostQuality[] = []) =>
  readThroughCache<HostedPostQuality[]>(
    publicKey("post-quality", "all"),
    fallback,
    () =>
      runHosted<HostedPostQuality[]>(fallback, async (client) =>
        (await selectQualityRows(client)).map(qualityRowToLocal),
      ),
    CACHE_TTL.postQuality,
  );

export const upsertHostedPostQuality = (userId: string | null | undefined, scores: HostedPostQuality[]) =>
  runHostedForUser<HostedPostQuality[]>(userId, scores, async (client, id) => {
    if (!scores.length) return scores;
    unwrapWrite(
      await client
        .from("post_quality_scores")
        .upsert(scores.map((score) => qualityToRow(id, score)), { onConflict: "post_id" }),
    );
    // Denormalised ranking columns on owner_posts are updated, never inserted,
    // so a score can not create a half-populated post row.
    await Promise.all(
      scores.map(async (score) =>
        unwrapWrite(
          await client
            .from("owner_posts")
            .update({
              last_ranked_at: score.computedAt,
              quality_grade: score.grade,
              quality_score: score.score,
              ranking_score: score.rankingScore,
            })
            .eq("id", score.postId)
            .eq("user_id", id),
        ),
      ),
    );
    // Ranking moved, so the shared feed and quality entries are now wrong.
    invalidateHostedNamespace("post-quality");
    invalidateHostedNamespace("feed");
    return scores;
  });

/** Score the caller's own posts and publish the results in one idempotent pass. */
export const publishHostedPostQuality = (userId: string | null | undefined, posts: OwnerPost[], now = Date.now()) =>
  upsertHostedPostQuality(userId, posts.map((post) => postToQuality(post, now)));
