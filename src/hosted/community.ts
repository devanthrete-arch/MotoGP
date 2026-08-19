import type { KnowledgeLabel, OwnerPost, ReportRecord, ReportStatus } from "../domain";
import { knowledgeLabels, vehicleFuels } from "../domain";
import { asAmount, asCount, asIsoTimestamp, asOneOf, asText, nowIso } from "./coerce";
import { type HostedClient, type HostedResult, runHosted, runHostedForUser, unwrap, unwrapWrite } from "./result";
import type { Insert, OwnerPostRow, PostCommentRow, ReportRow } from "./tables";

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

export const selectOwnerPostRows = async (client: HostedClient): Promise<OwnerPostRow[]> =>
  unwrap(await client.from("owner_posts").select("*").order("created_at", { ascending: false }), []);

export const selectCommentRows = async (client: HostedClient): Promise<PostCommentRow[]> =>
  unwrap(await client.from("post_comments").select("*").order("created_at", { ascending: true }), []);

export const selectReportRows = async (client: HostedClient, userId: string): Promise<ReportRow[]> =>
  unwrap(
    await client.from("reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    [],
  );

export const selectSavedPostIds = async (client: HostedClient, userId: string): Promise<string[]> => {
  const rows = unwrap(await client.from("saved_posts").select("post_id").eq("user_id", userId), []);
  return rows.map((row) => asText(row.post_id)).filter(Boolean);
};

/** Public feed read: works signed-out because `owner_posts` is anon-readable. */
export const listHostedPosts = (fallback: OwnerPost[] = []): Promise<HostedResult<OwnerPost[]>> =>
  runHosted<OwnerPost[]>(fallback, async (client) => {
    const [postRows, commentRows] = await Promise.all([selectOwnerPostRows(client), selectCommentRows(client)]);
    const commentsByPost = groupCommentLines(commentRows);
    return sortPostsByRecency(postRows.map((row) => postRowToLocal(row, commentsByPost.get(asText(row.id)) ?? [])));
  });

export const listHostedPostRankings = (fallback: HostedPostRanking[] = []) =>
  runHosted<HostedPostRanking[]>(fallback, async (client) =>
    (await selectOwnerPostRows(client)).map(postRowToRanking),
  );

export const upsertHostedPost = (userId: string | null | undefined, post: OwnerPost) =>
  runHostedForUser<OwnerPost>(userId, post, async (client, id) => {
    unwrapWrite(await client.from("owner_posts").upsert(postToRow(id, post), { onConflict: "id" }));
    return post;
  });

/** Bulk, idempotent publish of the whole local feed the signed-in user authored. */
export const upsertHostedPosts = (userId: string | null | undefined, posts: OwnerPost[]) =>
  runHostedForUser<OwnerPost[]>(userId, posts, async (client, id) => {
    if (!posts.length) return posts;
    unwrapWrite(
      await client.from("owner_posts").upsert(posts.map((post) => postToRow(id, post)), { onConflict: "id" }),
    );
    return posts;
  });

export const deleteHostedPost = (userId: string | null | undefined, postId: string) =>
  runHostedForUser<string>(userId, postId, async (client, id) => {
    unwrapWrite(await client.from("owner_posts").delete().eq("id", postId).eq("user_id", id));
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
