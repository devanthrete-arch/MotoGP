import { describe, expect, it } from "vitest";
import { seedGarage, seedPosts } from "../../../core/index";
import { buildCityCircles, buildOwnershipPlaybooks } from "../index";

describe("content domain", () => {
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

  it("turns model notebooks into ownership playbooks", () => {
    const playbooks = buildOwnershipPlaybooks(seedPosts);
    const nexon = playbooks.find((playbook) => playbook.key === "tata-nexon");

    expect(nexon).toMatchObject({
      brand: "Tata",
      confidence: "Early signal",
      evidenceCount: 1,
      model: "Nexon",
    });
    expect(nexon?.ownerSignals).toContain("Confirmed fixes are available before the owner needs a dealer second opinion.");
    expect(nexon?.buyerChecks[0]).toBe("Ask whether the common fix has already been done and keep the bill handy.");
  });
});
