import { afterEach, describe, expect, it, vi } from "vitest";
import type { CloudClient } from "./supabase";
import {
  deleteCommunityPost, loadCommunityPosts, loadMyCommunityPostIds, publishCommunityComment, publishCommunityPost,
  reportCommunityPost,
} from "./communityCloud";
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
    await expect(loadCommunityPosts({} as CloudClient, async () => null)).rejects.toThrow("Sign in");
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

  it("falls back to legacy post fields until the structured-review migration is installed", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify({ code: "PGRST204", message: "review_pros missing" }), {
        status: 400, headers: { "content-type": "application/json" },
      });
      return new Response(JSON.stringify([{ id: "old-post", ...draft, createdAt: "2026-10-09T00:00:00Z" }]), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const posts = await loadCommunityPosts(createClerkSupabaseClient(config, async () => "clerk-token"), async () => "clerk-token");
    expect(posts[0].id).toBe("cloud:old-post");
    expect(posts[0].reviewPros).toBeUndefined();
    expect(posts[0].reviewCons).toBeUndefined();
    expect(calls).toBe(2);
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("review_pros");
  });

  it("explains that the additive database update is needed before publishing a structured review", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "PGRST204", message: "review_pros missing" }), {
      status: 400, headers: { "content-type": "application/json" },
    })));
    const review = { ...draft, label: "Review" as const, reviewPros: "Comfort", reviewCons: "Noise", reviewVerdict: "buy-again" as const };
    await expect(publishCommunityPost(createClerkSupabaseClient(config, async () => "clerk-token"), review))
      .rejects.toThrow("Structured reviews aren’t available until the community database update is installed.");
  });

  it("still publishes ordinary owner notes to a database without review columns", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify({ code: "PGRST204", message: "review_pros missing" }), {
        status: 400, headers: { "content-type": "application/json" },
      });
      return new Response(JSON.stringify({ id: "legacy-post", ...draft, createdAt: "2026-10-09T00:00:00Z" }), {
        status: 201, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const post = await publishCommunityPost(createClerkSupabaseClient(config, async () => "clerk-token"), draft);
    expect(post.id).toBe("cloud:legacy-post");
    expect(calls).toBe(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).not.toHaveProperty("review_pros");
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
    await expect(publishCommunityComment(client, "cloud:post-id", "Reply")).resolves.toBeUndefined();
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("authorization")).toBe("Bearer clerk-token");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("author");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ post_id: "post-id", body: "Reply" });
  });

  it("sends only content columns when publishing, whatever the draft object carries", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ id: "post-id", ...draft, createdAt: "2026-10-07T00:00:00Z" }),
      { status: 201, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const tampered = { ...draft, createdAt: "2099-01-01T00:00:00Z", status: "hidden", id: "chosen", author_subject: "user_other" };
    await publishCommunityPost(createClerkSupabaseClient(config, async () => "clerk-token"), tampered);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(Object.keys(sent).sort()).toEqual(
      ["body", "brand", "city", "label", "model", "odometerKm", "review_cons", "review_pros", "review_verdict", "title", "topic", "variant"]);
  });

  it("lists the caller's own posts with the shared-post prefix", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify(["post-a", "post-b"]), { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = createClerkSupabaseClient(config, async () => "clerk-token");
    expect(await loadMyCommunityPostIds(client, async () => "clerk-token")).toEqual(["cloud:post-a", "cloud:post-b"]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rpc/my_community_post_ids");
  });

  it("reports a delete that removed nothing as not the author's note", async () => {
    const respond = (rows: unknown[]) => vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } },
    ));
    const client = createClerkSupabaseClient(config, async () => "clerk-token");
    const deleted = respond([{ id: "post-id" }]);
    vi.stubGlobal("fetch", deleted);
    await expect(deleteCommunityPost(client, "cloud:post-id")).resolves.toBeUndefined();
    expect(deleted.mock.calls[0][1]?.method).toBe("DELETE");
    expect(String(deleted.mock.calls[0][0])).toContain("id=eq.post-id");
    vi.stubGlobal("fetch", respond([]));
    await expect(deleteCommunityPost(client, "cloud:post-id")).rejects.toThrow("Only the author");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ code: "42501", message: "permission denied for table community_posts" }),
      { status: 403, headers: { "content-type": "application/json" } },
    )));
    await expect(deleteCommunityPost(client, "cloud:post-id")).rejects.toThrow("not available yet");
  });

  it("sends a trimmed report and names a repeat report plainly", async () => {
    const client = createClerkSupabaseClient(config, async () => "clerk-token");
    const created = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", created);
    await expect(reportCommunityPost(client, "cloud:post-id", "  Abusive  ")).resolves.toBeUndefined();
    expect(JSON.parse(String(created.mock.calls[0][1]?.body))).toEqual({ post_id: "post-id", reason: "Abusive" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ code: "23505", message: "duplicate key value" }),
      { status: 409, headers: { "content-type": "application/json" } },
    )));
    await expect(reportCommunityPost(client, "cloud:post-id", "Again")).rejects.toThrow("already reported");
  });
});
