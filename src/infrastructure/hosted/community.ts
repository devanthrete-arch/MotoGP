import type { KnowledgeLabel, OwnerPost, ReportRecord, ReportStatus } from "../../core/entities";
import { knowledgeLabels, vehicleFuels } from "../../core/entities";
import { CACHE_TTL, invalidateHostedNamespace, publicKey, readThroughCache } from "./kernel/cache";
import { asAmount, asCount, asIsoTimestamp, asOneOf, asText, nowIso } from "./kernel/coerce";
import { type HostedClient, type HostedResult, runHosted, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { Insert, OwnerPostRow, PostCommentRow, ReportRow } from "../supabase/tables";

export const reportStatusValues = ["Open", "Dismissed", "Removed"] as const satisfies readonly ReportStatus[];

export const qualityGradeValues = ["Needs context", "Useful draft", "Garage-grade"] as const;

export type HostedPostRanking = {
  postId: string;
  qualityScore: number;
  qualityGrade: (typeof qualityGradeValues)[number];
  rankingScore: number;
  lastRankedAt: string | null;
};

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const commentRowToLine = (row: Pick<PostCommentRow, "author" | "message">): string =>
  `${asText(row.author, "Owner")}: ${asText(row.message)}`;

export const groupCommentLines = (rows: Pick<PostCommentRow, "author" | "message" | "post_id">[]): Map<string, string[]> => {
  const grouped = new Map<string, string[]>();
  rows.forEach((row) => {
    const postId = asText(row.post_id);
    if (!postId) return;
    const lines = grouped.get(postId) ?? [];
    lines.push(commentRowToLine(row));
    grouped.set(postId, lines);
  });
  return grouped;
};

export const postRowToLocal = (row: OwnerPostRow, comments: string[] = []): OwnerPost => ({
  author: asText(row.author, "Owner"),
  body: asText(row.body),
  brand: asText(row.brand),
  city: asText(row.city),
  comments: [...comments],
  createdAt: asIsoTimestamp(row.created_at),
  fixesConfirmed: asCount(row.fixes_confirmed),
  helpful: asCount(row.helpful),
  id: asText(row.id),
  label: asOneOf<KnowledgeLabel>(row.label, knowledgeLabels, "Owner note"),
  model: asText(row.model),
  odometerKm: asCount(row.odometer_km),
  title: asText(row.title),
  topic: asText(row.topic, "Ownership"),
  fuel: asOneOf(row.fuel, vehicleFuels, ""),
  variant: asText(row.variant),
});

export const postToRow = (userId: string, post: OwnerPost): Insert<"owner_posts"> => ({
  author: asText(post.author, "Owner"),
  body: asText(post.body),
  brand: asText(post.brand),
  city: asText(post.city),
  created_at: asIsoTimestamp(post.createdAt),
  fixes_confirmed: asCount(post.fixesConfirmed),
  helpful: asCount(post.helpful),
  id: asText(post.id),
  label: asOneOf<KnowledgeLabel>(post.label, knowledgeLabels, "Owner note"),
  model: asText(post.model),
  odometer_km: asCount(post.odometerKm),
  title: asText(post.title),
  topic: asText(post.topic, "Ownership"),
  user_id: userId,
  fuel: post.fuel || null,
  variant: asText(post.variant),
});

export const postRowToRanking = (row: OwnerPostRow): HostedPostRanking => ({
  lastRankedAt: row.last_ranked_at ? asIsoTimestamp(row.last_ranked_at) : null,
  postId: asText(row.id),
  qualityGrade: asOneOf(row.quality_grade, qualityGradeValues, "Needs context"),
  qualityScore: asCount(row.quality_score),
  rankingScore: asAmount(row.ranking_score),
});

export const reportRowToLocal = (row: ReportRow): ReportRecord => ({
  createdAt: asIsoTimestamp(row.created_at),
  id: asText(row.id),
  postId: asText(row.post_id),
  postTitle: asText(row.post_title),
  reason: asText(row.reason),
  reporterName: asText(row.reporter_name, "Anonymous"),
  status: asOneOf<ReportStatus>(row.status, reportStatusValues, "Open"),
});

export const reportToRow = (userId: string, report: ReportRecord): Insert<"reports"> => ({
  created_at: asIsoTimestamp(report.createdAt),
  id: asText(report.id),
  post_id: asText(report.postId),
  post_title: asText(report.postTitle, "Untitled note"),
  reason: asText(report.reason, "No reason given"),
  reporter_name: asText(report.reporterName, "Anonymous"),
  status: asOneOf<ReportStatus>(report.status, reportStatusValues, "Open"),
  user_id: userId,
});

export const sortPostsByRecency = (posts: OwnerPost[]): OwnerPost[] =>
  [...posts].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

/** Last-write-wins merge of hosted and local posts, keyed on the app's post id. */
export const mergePostCollections = (local: OwnerPost[], hosted: OwnerPost[]): OwnerPost[] => {
  const merged = new Map<string, OwnerPost>();
  local.forEach((post) => merged.set(post.id, post));
  hosted.forEach((post) => {
    const existing = merged.get(post.id);
    if (!existing) {
      merged.set(post.id, post);
      return;
    }
    merged.set(post.id, {
      ...existing,
      comments: existing.comments.length >= post.comments.length ? existing.comments : post.comments,
      fixesConfirmed: Math.max(existing.fixesConfirmed, post.fixesConfirmed),
      helpful: Math.max(existing.helpful, post.helpful),
    });
  });
  return sortPostsByRecency([...merged.values()]);
};

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Columns the feed actually renders.
 *
 * `select("*")` shipped every column of every row; naming them keeps the wire
 * payload proportional to what is drawn, and lets Postgres serve the page from
 * an index-only scan.
 */
const FEED_COLUMNS =
  "id,title,author,brand,model,variant,fuel,city,odometer_km,label,topic,body,created_at,helpful,fixes_confirmed,comment_count,quality_score,quality_grade,ranking_score";

/** Rows per feed page. Keyset paging means cost is O(page), not O(table). */
export const FEED_PAGE_SIZE = 30;

/**
 * Upper bound for the compatibility helpers that still return "all" posts.
 * Without it a single call could stream an unbounded table into the browser.
 */
export const FEED_MAX_ROWS = 300;

export type FeedSort = "recent" | "ranked";

/**
 * Keyset cursor: the ordering value plus the primary key as a tiebreaker.
 *
 * OFFSET was deliberately avoided — its cost grows linearly with the number of
 * rows skipped, so deep pages get slower as the table grows. A keyset cursor
 * stays constant-time at any depth.
 */
export type FeedCursor = { id: string; value: string };

export type FeedPage = { hasMore: boolean; nextCursor: FeedCursor | null; posts: OwnerPost[] };

export const encodeFeedCursor = (cursor: FeedCursor | null): string =>
  cursor ? `${cursor.value}|${cursor.id}` : "";

export const decodeFeedCursor = (raw: string | null | undefined): FeedCursor | null => {
  if (typeof raw !== "string") return null;
  const separator = raw.lastIndexOf("|");
  if (separator <= 0 || separator === raw.length - 1) return null;
  return { id: raw.slice(separator + 1), value: raw.slice(0, separator) };
};

const sortColumn = (sort: FeedSort): "created_at" | "ranking_score" =>
  sort === "ranked" ? "ranking_score" : "created_at";

const cursorValueFor = (row: OwnerPostRow, sort: FeedSort): string =>
  sort === "ranked" ? String(row.ranking_score ?? 0) : asText(row.created_at);

export const selectOwnerPostRows = async (
  client: HostedClient,
  limit: number = FEED_MAX_ROWS,
): Promise<OwnerPostRow[]> =>
  unwrap(
    await client
      .from("owner_posts")
      .select(FEED_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit),
    [],
  ) as OwnerPostRow[];

/** Comment bodies for ONE post. The feed uses `comment_count` instead. */
export const selectCommentRowsForPost = async (
  client: HostedClient,
  postId: string,
): Promise<PostCommentRow[]> =>
  unwrap(
    await client
      .from("post_comments")
      .select("id,post_id,author,message,created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(500),
    [],
  ) as PostCommentRow[];

export const selectReportRows = async (client: HostedClient, userId: string): Promise<ReportRow[]> =>
  unwrap(
    await client.from("reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    [],
  );

export const selectSavedPostIds = async (client: HostedClient, userId: string): Promise<string[]> => {
  const rows = unwrap(await client.from("saved_posts").select("post_id").eq("user_id", userId), []);
  return rows.map((row) => asText(row.post_id)).filter(Boolean);
};

/**
 * One page of the public feed. Works signed-out (`owner_posts` is anon-readable).
 *
 * Comment bodies are NOT fetched here — the card only needs `comment_count`,
 * and the bodies load when a post is opened. Ranking data rides along on the
 * same rows, so the separate rankings scan is gone.
 */
export const listHostedPostsPage = (
  options: { cursor?: FeedCursor | null; limit?: number; sort?: FeedSort } = {},
): Promise<HostedResult<FeedPage>> => {
  const sort = options.sort ?? "recent";
  const limit = Math.max(1, Math.min(options.limit ?? FEED_PAGE_SIZE, 100));
  const cursor = options.cursor ?? null;
  const empty: FeedPage = { hasMore: false, nextCursor: null, posts: [] };
  // Safe to share between visitors: `owner_posts` is anon-readable, the page is
  // identical for everyone, and the key pins the exact (sort, cursor, size)
  // triple so page 2 can never be served as page 1.
  const key = publicKey("feed", sort, limit, encodeFeedCursor(cursor));

  const load = () =>
    runHosted<FeedPage>(empty, async (client) => {
      const column = sortColumn(sort);
      let query = client
        .from("owner_posts")
        .select(FEED_COLUMNS)
        .order(column, { ascending: false })
        .order("id", { ascending: false })
        // One extra row is a cheaper "is there more?" than a COUNT over the table.
        .limit(limit + 1);

      if (cursor) {
        // Strictly after the cursor in (value, id) order.
        query = query.or(
          `${column}.lt.${cursor.value},and(${column}.eq.${cursor.value},id.lt.${cursor.id})`,
        );
      }

      const rows = unwrap(await query, []) as OwnerPostRow[];
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const last = pageRows[pageRows.length - 1];

      return {
        hasMore,
        nextCursor: hasMore && last ? { id: asText(last.id), value: cursorValueFor(last, sort) } : null,
        posts: pageRows.map((row) => postRowToLocal(row, [])),
      };
    });

  return readThroughCache<FeedPage>(key, empty, load, CACHE_TTL.feedPage);
};

/**
 * Compatibility wrapper for callers that still want a single list.
 *
 * Capped at `FEED_MAX_ROWS`; prefer `listHostedPostsPage` in new code.
 */
export const listHostedPosts = (fallback: OwnerPost[] = []): Promise<HostedResult<OwnerPost[]>> =>
  runHosted<OwnerPost[]>(fallback, async (client) =>
    sortPostsByRecency((await selectOwnerPostRows(client)).map((row) => postRowToLocal(row, []))),
  );

/** Comment bodies for one post, loaded when the detail pane opens. */
export const listHostedCommentsForPost = (
  postId: string,
  fallback: string[] = [],
): Promise<HostedResult<string[]>> =>
  runHosted<string[]>(fallback, async (client) => {
    if (!postId) return fallback;
    const rows = await selectCommentRowsForPost(client, postId);
    return rows.map(commentRowToLine);
  });

export const listHostedPostRankings = (fallback: HostedPostRanking[] = []) =>
  runHosted<HostedPostRanking[]>(fallback, async (client) =>
    (await selectOwnerPostRows(client)).map(postRowToRanking),
  );

export const upsertHostedPost = (userId: string | null | undefined, post: OwnerPost) =>
  runHostedForUser<OwnerPost>(userId, post, async (client, id) => {
    unwrapWrite(await client.from("owner_posts").upsert(postToRow(id, post), { onConflict: "id" }));
    invalidateHostedNamespace("feed");
    return post;
  });

/** Bulk, idempotent publish of the whole local feed the signed-in user authored. */
export const upsertHostedPosts = (userId: string | null | undefined, posts: OwnerPost[]) =>
  runHostedForUser<OwnerPost[]>(userId, posts, async (client, id) => {
    if (!posts.length) return posts;
    unwrapWrite(
      await client.from("owner_posts").upsert(posts.map((post) => postToRow(id, post)), { onConflict: "id" }),
    );
    invalidateHostedNamespace("feed");
    return posts;
  });

export const deleteHostedPost = (userId: string | null | undefined, postId: string) =>
  runHostedForUser<string>(userId, postId, async (client, id) => {
    unwrapWrite(await client.from("owner_posts").delete().eq("id", postId).eq("user_id", id));
    invalidateHostedNamespace("feed");
    return postId;
  });

export const addHostedComment = (
  userId: string | null | undefined,
  postId: string,
  author: string,
  message: string,
) =>
  runHostedForUser<string>(userId, message, async (client, id) => {
    unwrapWrite(
      await client.from("post_comments").insert({
        author: asText(author, "Owner"),
        message: asText(message),
        post_id: postId,
        user_id: id,
      }),
    );
    return message;
  });

export const listHostedSavedPostIds = (userId: string | null | undefined, fallback: string[] = []) =>
  runHostedForUser<string[]>(userId, fallback, (client, id) => selectSavedPostIds(client, id));

export const setHostedSavedPost = (userId: string | null | undefined, postId: string, saved: boolean) =>
  runHostedForUser<boolean>(userId, saved, async (client, id) => {
    unwrapWrite(
      saved
        ? await client.from("saved_posts").upsert({ post_id: postId, user_id: id }, { onConflict: "user_id,post_id" })
        : await client.from("saved_posts").delete().eq("user_id", id).eq("post_id", postId),
    );
    return saved;
  });

export const replaceHostedSavedPosts = (userId: string | null | undefined, postIds: string[]) =>
  runHostedForUser<string[]>(userId, postIds, async (client, id) => {
    const unique = [...new Set(postIds.filter(Boolean))];
    unwrapWrite(await client.from("saved_posts").delete().eq("user_id", id));
    if (unique.length) {
      unwrapWrite(
        await client
          .from("saved_posts")
          .upsert(unique.map((postId) => ({ post_id: postId, user_id: id })), { onConflict: "user_id,post_id" }),
      );
    }
    return unique;
  });

export const listHostedReports = (userId: string | null | undefined, fallback: ReportRecord[] = []) =>
  runHostedForUser<ReportRecord[]>(userId, fallback, async (client, id) =>
    (await selectReportRows(client, id)).map(reportRowToLocal),
  );

export const upsertHostedReport = (userId: string | null | undefined, report: ReportRecord) =>
  runHostedForUser<ReportRecord>(userId, report, async (client, id) => {
    unwrapWrite(await client.from("reports").upsert(reportToRow(id, report), { onConflict: "id" }));
    return report;
  });

export const upsertHostedReports = (userId: string | null | undefined, reports: ReportRecord[]) =>
  runHostedForUser<ReportRecord[]>(userId, reports, async (client, id) => {
    if (!reports.length) return reports;
    unwrapWrite(
      await client.from("reports").upsert(reports.map((report) => reportToRow(id, report)), { onConflict: "id" }),
    );
    return reports;
  });

/** Moderation outcome for a report the signed-in user owns. */
export const setHostedReportStatus = (
  userId: string | null | undefined,
  reportId: string,
  status: ReportStatus,
) =>
  runHostedForUser<ReportStatus>(userId, status, async (client, id) => {
    unwrapWrite(
      await client
        .from("reports")
        .update({ status: asOneOf<ReportStatus>(status, reportStatusValues, "Open"), updated_at: nowIso() })
        .eq("id", reportId)
        .eq("user_id", id),
    );
    return status;
  });
