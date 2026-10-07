import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCommunityPosts, publishCommunityComment, publishCommunityPost } from "./communityCloud";
import { createClerkSupabaseClient } from "./supabase";

const config = { url: "https://example.supabase.co", publishableKey: "sb_publishable_fixture" };
const draft = {
  title: "Advice", author: "Owner", brand: "Tata", model: "Nexon", variant: "",
  city: "Pune", odometerKm: 100, label: "Owner note" as const, topic: "Ownership", body: "Useful detail",
};
afterEach(() => vi.unstubAllGlobals());

describe("community client", () => {
  it("does not fetch shared posts without a Clerk token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadCommunityPosts({} as SupabaseClient, async () => null)).rejects.toThrow("Sign in");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads only display columns using a current Clerk token", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([{
      id: "post-id", ...draft, createdAt: "2026-10-07T00:00:00Z",
    }]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const posts = await loadCommunityPosts(createClerkSupabaseClient(config, async () => "clerk-token"), async () => "clerk-token");
    expect(posts[0].id).toBe("cloud:post-id");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("author_subject");
    expect(String(fetchMock.mock.calls[0][0])).toContain("status=eq.published");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer clerk-token");
  });

  it("publishes with a session token and accepts an empty 204 comment response", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      calls += 1;
      return calls === 1 ? new Response(JSON.stringify({ id: "post-id", ...draft, createdAt: "2026-10-07T00:00:00Z" }), {
        status: 201, headers: { "content-type": "application/json" },
      }) : new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createClerkSupabaseClient(config, async () => "clerk-token");
    expect((await publishCommunityPost(client, draft)).id).toBe("cloud:post-id");
    await expect(publishCommunityComment(client, "cloud:post-id", "Owner", "Reply")).resolves.toBeUndefined();
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("authorization")).toBe("Bearer clerk-token");
  });
});
