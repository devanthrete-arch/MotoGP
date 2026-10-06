import { describe, expect, it } from "vitest";
import { comparisonFields, legacyVariantSourceFor, verifiedComparisonFor } from "./comparisonCatalog";

describe("manufacturer comparison catalog", () => {
  it("keeps all requested categories and practical spec fields", () => {
    expect(comparisonFields).toHaveLength(12);
    expect(comparisonFields.every((section) => section.fields.length > 0)).toBe(true);
  });

  it("uses the selected transmission for Elevate mileage", () => {
    expect(verifiedComparisonFor("Honda", "Elevate", "SV Petrol MT")?.values.mileage).toBe("15.31 km/l");
    expect(verifiedComparisonFor("Honda", "Elevate", "ZX CVT")?.values.mileage).toBe("16.92 km/l");
  });

  it("does not borrow specs from another trim", () => {
    expect(verifiedComparisonFor("Hyundai", "Creta", "EX Petrol MT")?.values.sunroof).toBe("No");
    expect(verifiedComparisonFor("Hyundai", "Creta", "SX Petrol CVT")).toBeUndefined();
    expect(verifiedComparisonFor("Tata", "Nexon", "Smart Petrol MT")).toBeUndefined();
  });

  it("keeps brake and mileage differences between Taigun engines", () => {
    const base = verifiedComparisonFor("Volkswagen", "Taigun", "Comfortline 1.0 TSI MT");
    const gt = verifiedComparisonFor("Volkswagen", "Taigun", "GT Plus 1.5 DSG");
    expect(base?.values.rearBrakes).toBe("Drum");
    expect(gt?.values.rearBrakes).toBe("Disc");
    expect(base?.values.mileage).not.toBe(gt?.values.mileage);
  });

  it("distinguishes base and top Exter equipment", () => {
    const base = verifiedComparisonFor("Hyundai", "Exter", "HX 2 Petrol MT");
    const top = verifiedComparisonFor("Hyundai", "Exter", "HX 10 Petrol AMT");
    expect(base?.values.connectedCar).toBe("No");
    expect(top?.values.connectedCar).toBe("Hyundai Bluelink");
    expect(base?.values.airbags).toBe(top?.values.airbags);
  });

  it("flags legacy labels without pretending that old stock is impossible", () => {
    expect(legacyVariantSourceFor("Mahindra", "XUV 3XO", "AX7L Diesel AT")?.url).toContain("mahindra.com");
    expect(legacyVariantSourceFor("Skoda", "Kushaq", "Onyx 1.0 TSI MT")?.url).toContain("skoda-auto.co.in");
    expect(legacyVariantSourceFor("Skoda", "Kushaq", "Classic+ 1.0 TSI MT")).toBeUndefined();
  });
});
