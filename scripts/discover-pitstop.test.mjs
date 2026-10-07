import { describe, expect, it } from "vitest";
import { buildCatalog, discoverPitstop } from "./discover-pitstop.mjs";

const video = (id, title = id) => ({
  id: { videoId: id },
  snippet: {
    channelTitle: "Trusted Garage",
    description: "Useful car advice",
    publishedAt: "2026-10-01T00:00:00Z",
    title,
    thumbnails: { medium: { url: `https://img.youtube.com/${id}.jpg` } },
  },
});

describe("Pitstop YouTube discovery", () => {
  it("creates real, unique, playable records and keeps the category", () => {
    const catalog = buildCatalog([
      { category: "Builds", items: [video("abc123")] },
      { category: "Ownership", items: [video("abc123"), video("def456")] },
    ], "2026-10-07T00:00:00Z");

    expect(catalog.clips).toHaveLength(2);
    expect(catalog.clips[0]).toMatchObject({
      category: "Builds",
      embedUrl: "https://www.youtube.com/watch?v=abc123",
      status: "published",
      thumbnailUrl: "https://img.youtube.com/abc123.jpg",
    });
    expect(catalog.clips[1].category).toBe("Ownership");
  });

  it("uses four category searches, each filtered to embeddable India results", async () => {
    const requests = [];
    const catalog = await discoverPitstop({
      apiKey: "test-key",
      outputPath: "unused",
      writeFileImpl: async () => undefined,
      fetchImpl: async (url) => {
        requests.push(new URL(url));
        return { ok: true, json: async () => ({ items: [] }) };
      },
    });

    expect(requests).toHaveLength(4);
    expect(requests.every((url) => url.searchParams.get("videoEmbeddable") === "true")).toBe(true);
    expect(requests.every((url) => url.searchParams.get("regionCode") === "IN")).toBe(true);
    expect(requests.every((url) => url.searchParams.get("safeSearch") === "strict")).toBe(true);
    expect(catalog.clips).toEqual([]);
  });

  it("does not replace the catalog when a YouTube search fails", async () => {
    await expect(discoverPitstop({
      apiKey: "test-key",
      outputPath: "unused",
      writeFileImpl: async () => undefined,
      fetchImpl: async () => ({ ok: false, status: 403 }),
    })).rejects.toThrow("YouTube search failed (403)");
  });
});
