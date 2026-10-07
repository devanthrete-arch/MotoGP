import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftPost, OwnerPost } from "./domain";
import type { ClerkTokenGetter } from "./supabase";

const postColumns = "id,title,author,brand,model,variant,city,odometerKm,label,topic,body,createdAt";
type PostRow = Omit<OwnerPost, "comments" | "helpful" | "fixesConfirmed">;
type CommentRow = { author: string; body: string };

export const isSharedPost = (id: string) => id.startsWith("cloud:");

function communityError(code?: string): Error {
  return new Error(["PGRST205", "42P01"].includes(code ?? "")
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
    .select("author,body").eq("post_id", postId.slice(6)).order("created_at", { ascending: false })
    .limit(100).abortSignal(AbortSignal.timeout(15000));
  if (error) throw communityError(error.code);
  return (data as CommentRow[]).map(row => `${row.author}: ${row.body}`);
}

export async function publishCommunityPost(client: SupabaseClient, draft: DraftPost): Promise<OwnerPost> {
  const { data, error } = await client.from("community_posts").insert({
    ...draft, title: draft.title.trim(), body: draft.body.trim(),
  }).select(postColumns).single();
  if (error || !data) throw communityError(error?.code);
  return asPost(data as PostRow);
}

export async function publishCommunityComment(client: SupabaseClient, postId: string, author: string, body: string): Promise<void> {
  const { error } = await client.from("community_comments")
    .insert({ post_id: postId.slice(6), author, body: body.trim() });
  if (error) throw communityError(error.code);
}
