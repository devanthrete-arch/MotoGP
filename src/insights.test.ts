import { describe, expect, it } from "vitest";
import { seedGarage, seedPosts, seedTimeline } from "./domain";
import {
  buildGarageInsights,
  buildGarageExportMarkdown,
  buildCityCircles,
  buildModelSharePayload,
  buildModerationSummary,
  buildNotificationPreview,
  buildPostSharePayload,
  buildReturnNudges,
  buildShortlistComparisons,
  filterPostsByMode,
  groupByModel,
  modelKeyFor,
} from "./insights";

describe("Autoflex insights", () => {
  it("normalizes model keys for follow matching", () => {
    expect(modelKeyFor("Maruti Suzuki", "Grand Vitara")).toBe("maruti-suzuki-grand-vitara");
  });

  it("groups posts into model notebooks by brand and model", () => {
    const notebooks = groupByModel(seedPosts);

    expect(notebooks.map((notebook) => notebook.key)).toContain("tata-nexon");
    expect(notebooks.find((notebook) => notebook.key === "tata-nexon")?.posts).toHaveLength(1);
  });

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

  it("builds return nudges from follows, saved notes, and service proximity", () => {
    const nudges = buildReturnNudges({
      followedModelSet: new Set(["tata-nexon"]),
      followedTopicSet: new Set(),
      garage: [{ ...seedGarage[0], odometerKm: 49500 }],
      posts: seedPosts,
      savedCount: 2,
    });

    expect(nudges).toEqual([
      "New fix surfaced for Tata Nexon.",
      "2 saved notes waiting in your garage shelf.",
      "Daily diesel is close to the next 10k km service checkpoint.",
    ]);
  });

  it("creates notification previews without requiring a backend", () => {
    const previews = buildNotificationPreview({
      follows: { models: ["tata-nexon"], topics: [] },
      posts: seedPosts,
      preference: { browserAlerts: true, emailDigest: true, quietHours: true },
    });

    expect(previews[0]).toBe("Browser alert: Tata Nexon has a new fix.");
  });

  it("summarizes garage service, spend, and community context", () => {
    const insights = buildGarageInsights(seedGarage, seedTimeline, seedPosts);

    expect(insights).toHaveLength(3);
    expect(insights[0].detail).toContain("km to the next 10k service marker");
    expect(insights[1].detail).toContain("₹9,550");
    expect(insights[2].detail).toContain("1 related ownership note");
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

  it("exports garage timeline as markdown", () => {
    const exportText = buildGarageExportMarkdown(seedGarage, seedTimeline);

    expect(exportText).toContain("# Autoflex garage export");
    expect(exportText).toContain("Daily diesel");
    expect(exportText).toContain("₹1,350");
  });

  it("compares buyer shortlist models against available ownership notes", () => {
    const comparisons = buildShortlistComparisons(
      [
        {
          brand: "Tata",
          budget: 1200000,
          id: "shortlist-nexon",
          model: "Nexon",
          notes: "Family compact SUV option",
          status: "Researching",
        },
        {
          brand: "Toyota",
          budget: 2200000,
          id: "shortlist-hyryder",
          model: "Hyryder",
          notes: "Needs owner data",
          status: "Test drive",
        },
      ],
      seedPosts,
    );

    expect(comparisons[0]).toMatchObject({
      confidence: "Medium",
      fixes: 1,
      relatedNotes: 1,
    });
    expect(comparisons[1]).toMatchObject({
      confidence: "Low",
      relatedNotes: 0,
    });
  });

  it("builds city circles from posts and garage vehicles", () => {
    const circles = buildCityCircles(seedPosts, seedGarage);
    const pune = circles.find((circle) => circle.city === "Pune");

    expect(pune).toMatchObject({
      city: "Pune",
      localSignal: "Active",
      topBrands: ["Tata"],
    });
    expect(pune?.hotTopics).toEqual(["Fix"]);
  });
});
