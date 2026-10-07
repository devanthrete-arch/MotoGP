import { describe, expect, it } from "vitest";
import { isAdminModeratorEmail, priceForModel } from "./App";
import { resolvePitStopMedia, topPitStopItems, type PitStopClip } from "./PitStopSection";

describe("Pit Stop clips", () => {
  it("filters published clips by category", () => {
    const clips = [
      {
        addedAt: "2026-10-01T00:00:00.000Z",
        category: "Builds",
        embedUrl: "https://www.instagram.com/explore/tags/carsofinstagram/",
        id: "builds",
        sourceLabel: "Instagram car clips",
        status: "published",
        summary: "Build clips",
        thumbnailLabel: "IG Builds",
        title: "Builds",
      },
      {
        addedAt: "2026-10-01T00:00:00.000Z",
        category: "Ownership",
        embedUrl: "https://www.instagram.com/explore/tags/carreview/",
        id: "ownership",
        sourceLabel: "Instagram car clips",
        status: "published",
        summary: "Ownership clips",
        thumbnailLabel: "IG Review",
        title: "Ownership",
      },
    ] as const;

    expect(topPitStopItems([...clips], "Ownership").map((clip) => clip.id)).toEqual(["ownership"]);
    expect(topPitStopItems([...clips], "All")).toHaveLength(2);
  });

  it("shows at most 50 actual published items rather than fabricating duplicates", () => {
    const clips = Array.from({ length: 55 }, (_, index) => ({
      addedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      category: "Builds",
      embedUrl: `https://www.instagram.com/reel/${index.toString().padStart(10, "0")}/`,
      id: `build-${index}`,
      sourceLabel: "Instagram",
      status: "published",
      summary: "Build clip",
      thumbnailLabel: "Build",
      title: `Build ${index}`,
    })) as PitStopClip[];

    const items = topPitStopItems(clips, "Builds");
    expect(items).toHaveLength(50);
    expect(new Set(items.map((item) => item.id)).size).toBe(50);
    expect(items[0].id).toBe("build-54");
  });

  it("resolves direct Instagram and YouTube links to safe embed players only", () => {
    expect(resolvePitStopMedia("https://www.instagram.com/reel/ABC123/")?.src)
      .toBe("https://www.instagram.com/reel/ABC123/embed/");
    expect(resolvePitStopMedia("https://youtu.be/abcdefghijk")?.src)
      .toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&playsinline=1&rel=0");
    expect(resolvePitStopMedia("https://www.instagram.com/explore/tags/cars/"))
      .toBeNull();
    expect(resolvePitStopMedia("https://example.com/video"))
      .toBeNull();
  });

  it("uses prewritten prices for compare models", () => {
    expect(priceForModel("Tata", "Nexon", "XZ+ Diesel MT", "Maharashtra", "New")).toBe(950000);
    expect(priceForModel("Tata", "Nexon", "XZ+ Diesel MT", "Maharashtra", "Test drive")).toBe(874000);
    expect(priceForModel("Tata", "Nexon", "XZ+ Diesel MT", "Karnataka", "New")).toBe(921500);
    expect(priceForModel("Tata", "Unknown")).toBe(0);
  });

  it("recognizes admin and moderator emails", () => {
    expect(isAdminModeratorEmail("PIYUSHDTU23@gmail.com")).toBe(true);
    expect(isAdminModeratorEmail("owner@example.com")).toBe(false);
  });
});
