import type { KnowledgeLabel, OwnerPost, ReportRecord } from "./domain";
import { getSupabaseClient } from "./supabase";

export type CloudCommunity = {
  postIds: Set<string>;
  posts: OwnerPost[];
};

export const loadCloudCommunity = async (): Promise<CloudCommunity> => {
  const client = getSupabaseClient();
  if (!client) return { postIds: new Set(), posts: [] };

  const [postsResult, commentsResult] = await Promise.all([
    client.from("owner_posts").select("*").order("created_at", { ascending: false }),
    client.from("post_comments").select("post_id, author, message, created_at").order("created_at", { ascending: false }),
  ]);
  if (postsResult.error) throw postsResult.error;
  if (commentsResult.error) throw commentsResult.error;

  const commentsByPost = new Map<string, string[]>();
  commentsResult.data.forEach((comment) => {
    const comments = commentsByPost.get(comment.post_id) ?? [];
    comments.push(`${comment.author}: ${comment.message}`);
    commentsByPost.set(comment.post_id, comments);
  });

  const posts = postsResult.data.map<OwnerPost>((post) => ({
    author: post.author,
    body: post.body,
    brand: post.brand,
    city: post.city,
    comments: commentsByPost.get(post.id) ?? [],
    createdAt: post.created_at,
    fixesConfirmed: post.fixes_confirmed,
    helpful: post.helpful,
    id: post.id,
    label: post.label as KnowledgeLabel,
    model: post.model,
    odometerKm: post.odometer_km,
    title: post.title,
    topic: post.topic,
    variant: post.variant,
  }));

  return { postIds: new Set(posts.map((post) => post.id)), posts };
};

export const publishCloudPost = async (userId: string, post: OwnerPost): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from("owner_posts").upsert({
    author: post.author,
    body: post.body,
    brand: post.brand,
    city: post.city,
    created_at: post.createdAt,
    fixes_confirmed: post.fixesConfirmed,
    helpful: post.helpful,
    id: post.id,
    label: post.label,
    model: post.model,
    odometer_km: post.odometerKm,
    title: post.title,
    topic: post.topic,
    user_id: userId,
    variant: post.variant,
  });
  if (error) throw error;
};

export const publishCloudComment = async (
  userId: string,
  postId: string,
  author: string,
  message: string,
): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from("post_comments").insert({ author, message, post_id: postId, user_id: userId });
  if (error) throw error;
};

export const publishCloudReport = async (userId: string, report: ReportRecord): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from("reports").insert({
    created_at: report.createdAt,
    id: report.id,
    post_id: report.postId,
    post_title: report.postTitle,
    reason: report.reason,
    reporter_name: report.reporterName,
    status: report.status,
    user_id: userId,
  });
  if (error) throw error;
};

export const setCloudSavedPost = async (userId: string, postId: string, saved: boolean): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  const query = saved
    ? client.from("saved_posts").upsert({ post_id: postId, user_id: userId })
    : client.from("saved_posts").delete().eq("user_id", userId).eq("post_id", postId);
  const { error } = await query;
  if (error) throw error;
};
