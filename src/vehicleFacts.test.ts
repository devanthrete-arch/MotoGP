import { describe, expect, it } from "vitest";
import type { GarageVehicle } from "./domain";
import { PLACEHOLDER, vehicleFactRows, vehicleFuel, vehicleTitle, vehicleTransmission } from "./vehicleFacts";

const vehicle = (overrides: Partial<GarageVehicle> = {}): GarageVehicle => ({
  brand: "Tata",
  city: "Pune",
  id: "v1",
  model: "Nexon",
  nickname: "Daily drive",
  odometerKm: 42000,
  purchaseMonth: "2021-08",
  variant: "XZ+",
  ...overrides,
});

describe("vehicle facts", () => {
  it("uses the recorded fuel when the owner has confirmed it", () => {
    const fact = vehicleFuel(vehicle({ fuel: "Diesel" }));
    expect(fact).toMatchObject({ label: "Diesel", source: "recorded", value: "Diesel" });
  });

  it("never guesses fuel from the variant string", () => {
    // The old implementation substring-matched "Diesel" out of the variant.
    expect(vehicleFuel(vehicle({ variant: "XZ+ Diesel MT" })).source).not.toBe("recorded");
  });

  it("does not fall back to Petrol when the model sells several fuels", () => {
    const fact = vehicleFuel(vehicle({ brand: "Tata", model: "Nexon" }));
    if (fact.source === "unknown") {
      expect(fact.label).toBe(PLACEHOLDER);
      expect(fact.value).toBeNull();
    } else {
      expect(fact.source).toBe("catalog");
    }
  });

  it("reports unknown for a model that is not in the catalog at all", () => {
    expect(vehicleFuel(vehicle({ brand: "Nissan", model: "Magnite" }))).toMatchObject({
      label: PLACEHOLDER,
      source: "unknown",
      value: null,
    });
    expect(vehicleTransmission(vehicle({ brand: "Nissan", model: "Magnite" })).label).toBe(PLACEHOLDER);
  });

  it("keeps fuel out of the title", () => {
    expect(vehicleTitle(vehicle({ fuel: "Diesel", variant: "XZ+" }))).toBe("Tata Nexon • XZ+");
    expect(vehicleTitle(vehicle({ variant: "" }))).toBe("Tata Nexon");
  });

  it("exposes variant, fuel, transmission and ownership as separate rows", () => {
    const rows = vehicleFactRows(vehicle({ fuel: "Diesel", ownership: "First owner", transmission: "MT" }));
    expect(rows.map((row) => row.label)).toEqual(["Variant", "Fuel", "Transmission", "Ownership"]);
    expect(rows.map((row) => row.fact.label)).toEqual(["XZ+", "Diesel", "MT", "First owner"]);
  });

  it("shows a placeholder rather than a blank for unrecorded ownership", () => {
    const rows = vehicleFactRows(vehicle());
    expect(rows[3]?.fact.label).toBe(PLACEHOLDER);
  });
});
