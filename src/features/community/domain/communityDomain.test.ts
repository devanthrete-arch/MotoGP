import { describe, expect, it } from "vitest";
import { groupByModel, seedPosts } from "../../../core/index";
import { buildModelSharePayload, buildModerationSummary, buildNotificationPreview, buildPostSharePayload, filterPostsByMode } from "../index";

describe("community domain", () => {
  it("filters following feed by followed model or topic", () => {
    const posts = filterPostsByMode(seedPosts, {
      followedModelSet: new Set(["honda-city"]),
      followedTopicSet: new Set(["Fix"]),
      mode: "following",
      query: "",
      saved: new Set(),
      selectedLabel: "All",
    });

    expect(posts.map((post) => post.id)).toEqual(["nexon-diesel-clutch", "city-hybrid-highway"]);
  });

  it("creates notification previews without requiring a backend", () => {
    const previews = buildNotificationPreview({
      follows: { models: ["tata-nexon"], topics: [] },
      posts: seedPosts,
      preference: { browserAlerts: true, emailDigest: true, quietHours: true },
    });

    expect(previews[0]).toBe("Browser alert: Tata Nexon has a new fix.");
  });

  it("summarizes moderation queue and flags repeatedly reported posts", () => {
    const summary = buildModerationSummary([
      {
        createdAt: "2026-07-20T10:00:00.000Z",
        id: "report-1",
        postId: "post-a",
        postTitle: "Post A",
        reason: "Spam lead",
        reporterName: "Owner",
        status: "Open",
      },
      {
        createdAt: "2026-07-20T11:00:00.000Z",
        id: "report-2",
        postId: "post-a",
        postTitle: "Post A",
        reason: "Duplicate spam",
        reporterName: "Buyer",
        status: "Open",
      },
      {
        createdAt: "2026-07-20T12:00:00.000Z",
        id: "report-3",
        postId: "post-b",
        postTitle: "Post B",
        reason: "Resolved",
        reporterName: "Mod",
        status: "Dismissed",
      },
    ]);

    expect(summary).toEqual({
      dismissedReports: 1,
      openReports: 2,
      removedReports: 0,
      riskyPostIds: ["post-a"],
    });
  });

  it("builds share text for posts and model notebooks", () => {
    const postShare = buildPostSharePayload(seedPosts[0]);
    const notebookShare = buildModelSharePayload(groupByModel(seedPosts)[0]);

    expect(postShare.title).toContain("Tata Nexon");
    expect(postShare.text).toContain("42,000 km");
    expect(notebookShare.text).toContain("owner note");
  });
});
