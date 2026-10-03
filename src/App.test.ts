import { describe, expect, it } from "vitest";
import { buildTopPitStopReels, filterPitStopClipsByCategory, isAdminModeratorEmail, priceForModel } from "./App";

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

    expect(filterPitStopClipsByCategory([...clips], "Ownership").map((clip) => clip.id)).toEqual(["ownership"]);
    expect(filterPitStopClipsByCategory([...clips], "All")).toHaveLength(2);
  });

  it("does not invent individual reels from a hashtag page", () => {
    const reels = buildTopPitStopReels([
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
    ]);

    expect(reels).toHaveLength(0);
  });

  it("uses prewritten prices for compare models", () => {
    expect(priceForModel("Tata", "Nexon", "XZ+ Diesel MT", "Maharashtra", "New")).toBe(950000);
    expect(priceForModel("Tata", "Nexon", "XZ+ Diesel MT", "Maharashtra", "Test drive")).toBe(950000);
    expect(priceForModel("Tata", "Nexon", "XZ+ Diesel MT", "Karnataka", "New")).toBe(950000);
    expect(priceForModel("Tata", "Unknown")).toBe(0);
  });

  it("recognizes admin and moderator emails", () => {
    expect(isAdminModeratorEmail("PIYUSHDTU23@gmail.com")).toBe(true);
    expect(isAdminModeratorEmail("owner@example.com")).toBe(false);
  });
});
