import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPitStopVideos } from "./youtube";

afterEach(() => vi.unstubAllGlobals());

describe("Pit Stop YouTube search", () => {
  it("rejects unknown categories without making an outbound request", async () => {
    const result = await searchPitStopVideos("private", "test-key");
    expect(result).toMatchObject({ status: 400, videos: [] });
  });

  it("reports missing server configuration without leaking an API credential", async () => {
    const result = await searchPitStopVideos("All", "");
    expect(result).toEqual({ status: 503, videos: [], error: "Video search is not configured yet." });
  });

  it("requests India-relevant embeddable Creative Commons videos and returns safe metadata", async () => {
    const fetchMock = vi.fn(async (input: URL | string) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/videos")) return new Response(JSON.stringify({ items: [{
        id: "abcdefghijk", contentDetails: { duration: "PT3M42S" }, status: { embeddable: true },
      }] }), { status: 200 });
      expect(url.searchParams.get("videoLicense")).toBe("creativeCommon");
      expect(url.searchParams.get("videoEmbeddable")).toBe("true");
      expect(url.searchParams.get("regionCode")).toBe("IN");
      return new Response(JSON.stringify({ items: [{
        id: { videoId: "abcdefghijk" },
        snippet: { channelTitle: "Channel", title: " Build story ", thumbnails: { high: { url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" } } },
      }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchPitStopVideos("Builds", "test-key");
    expect(result).toMatchObject({ status: 200, videos: [{ category: "Builds", channel: "Channel", duration: "3:42", embeddable: true, title: "Build story" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
