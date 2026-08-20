import { describe, expect, it } from "vitest";
import { assessPostQuality, groupByModel, modelKeyFor, seedPosts } from "./index";

describe("core domain rules", () => {
  it("normalizes model keys for follow matching", () => {
    expect(modelKeyFor("Maruti Suzuki", "Grand Vitara")).toBe("maruti-suzuki-grand-vitara");
  });

  it("groups posts into model notebooks by brand and model", () => {
    const notebooks = groupByModel(seedPosts);

    expect(notebooks.map((notebook) => notebook.key)).toContain("tata-nexon");
    expect(notebooks.find((notebook) => notebook.key === "tata-nexon")?.posts).toHaveLength(1);
  });

  it("assesses post quality with actionable missing context prompts", () => {
    const strongReport = assessPostQuality(seedPosts[0]);
    const thinReport = assessPostQuality({
      body: "Good car.",
      city: "",
      label: "Owner note",
      odometerKm: 0,
      variant: "",
    });

    expect(strongReport).toMatchObject({
      grade: "Garage-grade",
      maxScore: 6,
      score: 6,
    });
    expect(thinReport).toMatchObject({
      grade: "Needs context",
      score: 0,
    });
    expect(thinReport.missingPrompts).toContain("Add odometer reading to anchor the issue, review, or cost note.");
  });
});
