import { describe, expect, it } from "vitest";
import { seedGarage, seedPosts, seedTimeline } from "../../../core/index";
import { buildGarageCostLedger, buildGarageExportMarkdown, buildGarageInsights, buildGarageReminders, buildVehicleProfile } from "../index";

describe("garage domain", () => {
  it("summarizes garage service, spend, and community context", () => {
    const insights = buildGarageInsights(seedGarage, seedTimeline, seedPosts);

    expect(insights).toHaveLength(3);
    expect(insights[0].detail).toContain("km to the next 10k service marker");
    expect(insights[1].detail).toContain("₹9,550");
    expect(insights[2].detail).toContain("1 related ownership note");
  });

  it("builds garage cost ledger from vehicle timeline", () => {
    const ledger = buildGarageCostLedger(seedGarage, seedTimeline);

    expect(ledger[0]).toMatchObject({
      entryCount: 2,
      highestLoggedOdometerKm: 42000,
      totalSpend: 9550,
    });
    expect(ledger[0].costPerKm).toBeCloseTo(0.227);
    expect(ledger[0].latestEntry?.id).toBe("timeline-nexon-service");
  });

  it("builds garage reminders from mileage and timeline gaps", () => {
    const reminders = buildGarageReminders(
      [{ ...seedGarage[0], odometerKm: 49550 }],
      [
        ...seedTimeline,
        {
          amount: 0,
          happenedOn: "2025-07-01",
          id: "timeline-nexon-tyres",
          kind: "Tyres",
          note: "Tyres changed before monsoon.",
          odometerKm: 12000,
          title: "Tyre set replaced",
          vehicleId: "garage-nexon",
        },
      ],
      new Date("2026-07-20T00:00:00.000Z"),
    );

    expect(reminders.map((reminder) => reminder.title)).toEqual([
      "Plan the next service visit",
      "Log insurance renewal details",
      "Inspect tyre age and wear",
    ]);
    expect(reminders[0]).toMatchObject({
      urgency: "Soon",
      vehicleName: "Daily drive",
    });
  });

  it("exports garage timeline as markdown", () => {
    const exportText = buildGarageExportMarkdown(seedGarage, seedTimeline);

    expect(exportText).toContain("# Autoflex garage export");
    expect(exportText).toContain("Daily drive");
    // Metadata exports as labelled lines, never folded into the vehicle line.
    expect(exportText).toContain("- Variant: XZ+");
    expect(exportText).toContain("- Fuel: Diesel");
    expect(exportText).toContain("- Transmission: MT");
    expect(exportText).toContain("- Ownership: First owner");
    expect(exportText).toContain("₹1,350");
  });
});


describe("vehicle profile fuel", () => {
  const base = {
    brand: "Tata",
    city: "Pune",
    id: "profile-vehicle",
    model: "Nexon",
    nickname: "Daily drive",
    odometerKm: 42000,
    purchaseMonth: "2021-08",
    variant: "XZ+",
  };

  it("uses the fuel the owner recorded", () => {
    expect(buildVehicleProfile({ ...base, fuel: "Diesel" }, []).fuel).toBe("Diesel");
  });

  it("returns null instead of inferring fuel from the variant string", () => {
    expect(buildVehicleProfile({ ...base, variant: "XZ+ Diesel MT" }, []).fuel).toBeNull();
  });

  it("never falls back to Petrol for a multi-fuel model", () => {
    expect(buildVehicleProfile(base, []).fuel).not.toBe("Petrol");
  });
});
