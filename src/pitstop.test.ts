import { describe, expect, it } from "vitest";
import { buildTopPitStopReels, filterPitStopClipsByCategory, pitStopCategories, pitStopClips, type PitStopClip } from "./pitstop";

const clip = (embedUrl: string, overrides: Partial<PitStopClip> = {}): PitStopClip => ({
  addedAt: "2026-10-01T00:00:00.000Z",
  category: "Builds",
  embedUrl,
  id: "curated-clip",
  sourceLabel: "Curated source",
  status: "published",
  summary: "Original editorial summary",
  thumbnailLabel: "Build",
  title: "Original editorial title",
  ...overrides,
});

describe("Pit Stop collections", () => {
  it("exports four external collections without unproven vehicle tags", () => {
    expect(pitStopClips).toHaveLength(4);
    expect(new Set(pitStopClips.map((item) => item.embedUrl)).size).toBe(4);
    expect(pitStopClips.map((item) => item.category)).toEqual(pitStopCategories.slice(1));
    for (const item of pitStopClips) {
      expect(item.embedUrl).toMatch(/^https:\/\/www\.instagram\.com\/explore\/tags\/[a-z]+\/$/);
      expect(item.status).toBe("published");
      expect(item).not.toHaveProperty("brand");
      expect(item).not.toHaveProperty("model");
    }
  });

  it("does not manufacture reels from hashtag collections", () => {
    expect(buildTopPitStopReels(pitStopClips)).toEqual([]);
    expect(buildTopPitStopReels([])).toEqual([]);
  });

  it("filters collections by category", () => {
    expect(filterPitStopClipsByCategory(pitStopClips, "All")).toEqual(pitStopClips);
    expect(filterPitStopClipsByCategory(pitStopClips, "Ownership")).toEqual([pitStopClips[2]]);
  });
});

describe("curated Pit Stop permalinks", () => {
  it("preserves supplied metadata and order for reel and post permalinks", () => {
    const first = clip("https://www.instagram.com/reel/AbC_123-/");
    const second = clip("https://instagram.com/p/Other123", { id: "second", category: "India" });
    expect(buildTopPitStopReels([first, second])).toEqual([first, second].map((item) => ({
      category: item.category,
      embedUrl: item === first ? first.embedUrl : "https://www.instagram.com/p/Other123/",
      id: item.id,
      sourceLabel: item.sourceLabel,
      summary: item.summary,
      title: item.title,
    })));
  });

  it("deduplicates host, trailing slash, tracking query and fragment variants", () => {
    const first = clip("https://instagram.com/reel/AbC123?igsh=tracking#fragment");
    const duplicate = clip("https://www.instagram.com/reel/AbC123/", { id: "duplicate" });
    const result = buildTopPitStopReels([first, duplicate]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(first.id);
    expect(result[0].embedUrl).toBe("https://www.instagram.com/reel/AbC123/");
    expect(first.embedUrl).toContain("?igsh=tracking");
  });

  it("ignores pending and removed clips without suppressing a published duplicate", () => {
    const url = "https://www.instagram.com/reel/AbC123/";
    expect(buildTopPitStopReels([
      clip(url, { status: "pending" }),
      clip(url, { status: "removed" }),
      clip(url, { id: "published" }),
    ]).map((item) => item.id)).toEqual(["published"]);
  });

  it.each([
    "not a URL",
    "/reel/AbC123/",
    "http://www.instagram.com/reel/AbC123/",
    "https://www.instagram.com.evil.example/reel/AbC123/",
    "https://evil.example/reel/AbC123/",
    "https://www.instagram.com@evil.example/reel/AbC123/",
    "https://user:password@www.instagram.com/reel/AbC123/",
    "https://www.instagram.com:8443/reel/AbC123/",
    "https://www.instagram.com/explore/tags/carreview/",
    "https://www.instagram.com/somecreator/",
    "https://www.instagram.com/reels/AbC123/",
    "https://www.instagram.com/reel/",
    "https://www.instagram.com/p/",
    "https://www.instagram.com/reel/AbC123/embed/",
    "https://www.instagram.com/p/AbC%20123/",
  ])("rejects non-permalink URL %s", (url) => {
    expect(buildTopPitStopReels([clip(url)])).toEqual([]);
  });
});
