import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftPost, OwnerPost } from "./domain";
import type { ClerkTokenGetter } from "./supabase";

const postColumns = "id,title,author,brand,model,variant,city,odometerKm,label,topic,body,createdAt";
type PostRow = Omit<OwnerPost, "comments" | "helpful" | "fixesConfirmed">;
type CommentRow = { author: string; body: string };

export const isSharedPost = (id: string) => id.startsWith("cloud:");
const cloudId = (postId: string) => postId.slice(6);

// Missing table, missing function, or a schema cache that has not seen the migration yet.
const notSetUpCodes = ["PGRST202", "PGRST205", "42P01", "42883"];

function communityError(code?: string): Error {
  return new Error(notSetUpCodes.includes(code ?? "")
    ? "Shared community is not set up yet. Local examples remain available."
    : "Community service is unavailable. Check your connection and retry.");
}

function asPost(row: PostRow): OwnerPost {
  return { ...row, id: `cloud:${row.id}`, helpful: 0, fixesConfirmed: 0, comments: [] };
}

async function requireToken(getToken: ClerkTokenGetter): Promise<void> {
  if (!await getToken()) throw new Error("Sign in to read the shared community.");
}

export async function loadCommunityPosts(client: SupabaseClient, getToken: ClerkTokenGetter): Promise<OwnerPost[]> {
  await requireToken(getToken);
  const { data, error } = await client.from("community_posts")
    .select(postColumns).eq("status", "published").order("createdAt", { ascending: false })
    .limit(50).abortSignal(AbortSignal.timeout(15000));
  if (error) throw communityError(error.code);
  return (data as PostRow[]).map(asPost);
}

export async function loadCommunityComments(client: SupabaseClient, getToken: ClerkTokenGetter, postId: string): Promise<string[]> {
  await requireToken(getToken);
  const { data, error } = await client.from("community_comments")
    .select("author,body").eq("post_id", cloudId(postId)).order("created_at", { ascending: false })
    .limit(100).abortSignal(AbortSignal.timeout(15000));
  if (error) throw communityError(error.code);
  return (data as CommentRow[]).map(row => `${row.author}: ${row.body}`);
}

// Ids of the caller's own published posts. The author column is not readable, so the server answers.
export async function loadMyCommunityPostIds(client: SupabaseClient, getToken: ClerkTokenGetter): Promise<string[]> {
  await requireToken(getToken);
  const { data, error } = await client.rpc("my_community_post_ids").abortSignal(AbortSignal.timeout(15000));
  if (error) throw communityError(error.code);
  return (data as string[]).map(id => `cloud:${id}`);
}

export async function publishCommunityPost(client: SupabaseClient, draft: DraftPost): Promise<OwnerPost> {
  // Only content columns are sent; the server sets id, author subject, createdAt and status.
  const { data, error } = await client.from("community_posts").insert({
    title: draft.title.trim(), author: draft.author, brand: draft.brand, model: draft.model,
    variant: draft.variant, city: draft.city, odometerKm: draft.odometerKm, label: draft.label,
    topic: draft.topic, body: draft.body.trim(),
  }).select(postColumns).single();
  if (error || !data) throw communityError(error?.code);
  return asPost(data as PostRow);
}

export async function publishCommunityComment(client: SupabaseClient, postId: string, author: string, body: string): Promise<void> {
  const { error } = await client.from("community_comments")
    .insert({ post_id: cloudId(postId), author, body: body.trim() });
  if (error) throw communityError(error.code);
}

export async function deleteCommunityPost(client: SupabaseClient, postId: string): Promise<void> {
  const { data, error } = await client.from("community_posts").delete().eq("id", cloudId(postId)).select("id");
  // 42501: the database does not grant deletes yet (feed hardening migration not applied).
  if (error?.code === "42501") throw new Error("Deleting notes is not available yet.");
  if (error) throw communityError(error.code);
  if (!data?.length) throw new Error("Only the author can delete this note.");
}

export async function reportCommunityPost(client: SupabaseClient, postId: string, reason: string): Promise<void> {
  const { error } = await client.from("community_reports").insert({ post_id: cloudId(postId), reason: reason.trim() });
  if (error?.code === "23505") throw new Error("You have already reported this note.");
  if (error) throw communityError(error.code);
}
