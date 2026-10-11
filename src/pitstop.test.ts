import { describe, expect, it } from "vitest";
import { buildTopPitStopReels, filterPitStopClipsByCategory, parsePitStopVideos, pitStopCategories, pitStopClips, youtubeVideoId } from "./pitstop";

const video = (overrides: Record<string, unknown> = {}) => ({
  videoId: "abcdefghijk", title: "A real title", channel: "A real channel", category: "Builds", embeddable: true, ...overrides,
});

describe("Pit Stop YouTube records", () => {
  it("ships no sample media and retains the category filters", () => {
    expect(pitStopClips).toEqual([]);
    expect(pitStopCategories).toEqual(["All", "Builds", "Launches", "Ownership", "India"]);
    expect(filterPitStopClipsByCategory([], "All")).toEqual([]);
    expect(buildTopPitStopReels([])).toEqual([]);
  });

  it.each([
    ["abcdefghijk", "abcdefghijk"],
    ["https://youtu.be/abcdefghijk", "abcdefghijk"],
    ["https://www.youtube.com/watch?v=abcdefghijk&t=20", "abcdefghijk"],
    ["https://www.youtube-nocookie.com/embed/abcdefghijk", null],
    ["https://youtube.com.evil.test/watch?v=abcdefghijk", null],
    ["http://youtube.com/watch?v=abcdefghijk", null],
    ["abcdefghij!", null],
  ])("validates video identifiers from %s", (value, expected) => {
    expect(youtubeVideoId(value)).toBe(expected);
  });

  it("accepts only complete real video metadata and keeps provider embeddability", () => {
    expect(parsePitStopVideos({ videos: [video(), video({ videoId: "bad" }), video({ embeddable: "true" }), video({ category: "Unknown" })] }, "All"))
      .toEqual([{
        category: "Builds", channel: "A real channel", embeddable: true, id: "abcdefghijk",
        thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", title: "A real title", videoId: "abcdefghijk",
      }]);
  });

  it("rejects cross-category results and untrusted thumbnail URLs", () => {
    expect(parsePitStopVideos({ videos: [video({ category: "India", thumbnailUrl: "https://evil.example/image.jpg" })] }, "Builds"))
      .toEqual([]);
    expect(parsePitStopVideos({ videos: [video({ thumbnailUrl: "https://evil.example/image.jpg" })] }, "Builds")[0].thumbnailUrl)
      .toBe("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
  });

  it("caps a response at 50 records and removes duplicate video IDs", () => {
    const result = parsePitStopVideos({ videos: Array.from({ length: 60 }, (_, i) => video({ videoId: `id${String(i).padStart(9, "0")}` })) }, "All");
    expect(result).toHaveLength(50);
    expect(parsePitStopVideos({ videos: [video(), video({ id: "duplicate" })] }, "All")).toHaveLength(1);
  });

  it("treats malformed responses as an empty collection", () => {
    expect(parsePitStopVideos(null, "All")).toEqual([]);
    expect(parsePitStopVideos({ videos: "no" }, "All")).toEqual([]);
  });
});
