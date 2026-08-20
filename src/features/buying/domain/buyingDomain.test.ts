import { describe, expect, it } from "vitest";
import { seedPosts } from "../../../core/index";
import { buildInspectionChecklists, buildShortlistComparisons, buildShortlistDecisionLanes } from "../index";

describe("buying domain", () => {
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

  it("prioritizes buyer shortlist next actions from evidence and status", () => {
    const lanes = buildShortlistDecisionLanes(
      [
        {
          brand: "Toyota",
          budget: 2200000,
          id: "shortlist-hyryder",
          model: "Hyryder",
          notes: "Needs owner data",
          status: "Test drive",
        },
        {
          brand: "Mahindra",
          budget: 1800000,
          id: "shortlist-xuv",
          model: "XUV700",
          notes: "Already rejected",
          status: "Rejected",
        },
        {
          brand: "Tata",
          budget: 1200000,
          id: "shortlist-nexon",
          model: "Nexon",
          notes: "Family compact SUV option",
          status: "Researching",
        },
      ],
      [
        ...seedPosts,
        {
          author: "Owner",
          body: "Repeated clutch issue appeared in traffic before the fix was attempted.",
          brand: "Tata",
          city: "Pune",
          comments: [],
          createdAt: "2026-07-21T10:00:00.000Z",
          fixesConfirmed: 0,
          helpful: 1,
          id: "nexon-clutch-issue",
          label: "Known issue",
          model: "Nexon",
          odometerKm: 39000,
          title: "Clutch judder in traffic",
          topic: "Drivetrain",
          variant: "Diesel AMT",
        },
        {
          author: "Owner",
          body: "Another owner saw similar low-speed drivetrain shudder before service inspection.",
          brand: "Tata",
          city: "Pune",
          comments: [],
          createdAt: "2026-07-21T11:00:00.000Z",
          fixesConfirmed: 0,
          helpful: 1,
          id: "nexon-second-clutch-issue",
          label: "Known issue",
          model: "Nexon",
          odometerKm: 41000,
          title: "Second clutch shudder report",
          topic: "Drivetrain",
          variant: "Diesel AMT",
        },
      ],
    );

    expect(lanes.map((lane) => lane.decision)).toEqual(["Gather evidence", "Inspect risk", "Archive"]);
    expect(lanes).toHaveLength(3);
    expect(lanes[0]).toMatchObject({
      item: expect.objectContaining({ model: "Hyryder" }),
      priority: "High",
    });
    expect(lanes[1].signal).toContain("2 issue signals");
  });

  it("builds buyer inspection checklists from shortlist evidence", () => {
    const checklists = buildInspectionChecklists(
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

    expect(checklists[0].checklist[0]).toMatchObject({
      priority: "High",
      title: "Verify common fix history",
    });
    expect(checklists[0].checklist.map((item) => item.title)).toContain("Match odometer-stage expectations");
    expect(checklists[1].checklist).toEqual([
      {
        detail: "Carry a short test-drive route, inspect tyres, service records, insurance claims, and cold-start behavior.",
        id: "shortlist-hyryder-baseline",
        priority: "High",
        title: "Start with a baseline inspection checklist",
      },
    ]);
  });
});
