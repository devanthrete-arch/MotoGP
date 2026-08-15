import { describe, expect, it } from "vitest";
import {
  carCatalog,
  findModel,
  formatINR,
  indianStates,
  modelsByBrand,
  onRoadPriceINR,
  stateOnRoadFactor,
} from "./carData";
import { modelsForBrand, vehicleBrands } from "./vehicleCatalog";

describe("car catalog data", () => {
  it("covers every brand with enough models", () => {
    const lightCoverage = new Set(["Skoda", "Volkswagen", "Honda"]);
    for (const brand of vehicleBrands) {
      const min = lightCoverage.has(brand) ? 1 : 2;
      expect(
        modelsByBrand(brand).length,
        `brand ${brand} should have at least ${min} models`,
      ).toBeGreaterThanOrEqual(min);
    }
  });

  it("has at least one variant per model", () => {
    for (const model of carCatalog) {
      expect(model.variants.length, `${model.brand} ${model.model}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps all prices in a sane Indian-market band", () => {
    for (const model of carCatalog) {
      for (const v of model.variants) {
        expect(v.priceExShowroomINR, `${model.brand} ${model.model} ${v.name}`).toBeGreaterThan(
          300000,
        );
        expect(v.priceExShowroomINR, `${model.brand} ${model.model} ${v.name}`).toBeLessThan(
          15000000,
        );
      }
    }
  });

  it("rounds prices to the nearest thousand", () => {
    for (const model of carCatalog) {
      for (const v of model.variants) {
        expect(v.priceExShowroomINR % 1000, `${model.brand} ${model.model} ${v.name}`).toBe(0);
      }
    }
  });

  it("keeps model names unique per brand", () => {
    for (const brand of vehicleBrands) {
      const names = modelsByBrand(brand).map((m) => m.model);
      expect(new Set(names).size, `brand ${brand}`).toBe(names.length);
    }
  });

  it("only uses brands and models present in the vehicle catalog", () => {
    const brands = new Set<string>(vehicleBrands);
    for (const model of carCatalog) {
      expect(brands.has(model.brand), `unknown brand ${model.brand}`).toBe(true);
      expect(
        modelsForBrand(model.brand),
        `${model.model} missing from ${model.brand} vehicle list`,
      ).toContain(model.model);
    }
  });

  it("computes on-road price monotonically in ex-showroom price", () => {
    const prices = carCatalog
      .flatMap((m) => m.variants.map((v) => v.priceExShowroomINR))
      .sort((a, b) => a - b);
    for (const state of indianStates) {
      for (let i = 1; i < prices.length; i++) {
        expect(onRoadPriceINR(prices[i], state)).toBeGreaterThanOrEqual(
          onRoadPriceINR(prices[i - 1], state),
        );
      }
    }
    // on-road is never below ex-showroom
    expect(onRoadPriceINR(1000000, "Delhi")).toBeGreaterThan(1000000);
    // unknown state falls back to a sensible default factor
    expect(onRoadPriceINR(1000000, "Atlantis")).toBe(1120000);
  });

  it("has plausible on-road factors for every state", () => {
    for (const state of indianStates) {
      expect(stateOnRoadFactor[state]).toBeGreaterThan(1);
      expect(stateOnRoadFactor[state]).toBeLessThan(1.35);
    }
  });

  it("formats INR into Cr and L notation", () => {
    expect(formatINR(12500000)).toBe("₹1.25 Cr");
    expect(formatINR(10000000)).toBe("₹1.00 Cr");
    expect(formatINR(729000)).toBe("₹7.29 L");
    expect(formatINR(100000)).toBe("₹1.00 L");
    expect(formatINR(99999)).not.toContain("L");
    expect(formatINR(99999)).not.toContain("Cr");
  });

  it("looks up models via helpers", () => {
    const swift = findModel("Maruti Suzuki", "Swift");
    expect(swift).toBeDefined();
    expect(swift?.bodyType).toBe("Hatchback");
    expect(findModel("Maruti Suzuki", "Nonexistent")).toBeUndefined();
    expect(modelsByBrand("Tata").map((m) => m.model)).toContain("Nexon");
  });

  it("gives EV variants a range figure and no engineCC", () => {
    for (const model of carCatalog) {
      for (const v of model.variants) {
        if (v.fuel === "Electric") {
          expect(v.transmission).toBe("Single Speed");
          expect(v.engineCC).toBeUndefined();
          // mileage field carries km range for EVs; real EVs here do >200 km
          expect(v.mileageKMPL ?? 0).toBeGreaterThan(200);
        }
      }
    }
  });

  it("hits the target catalog size", () => {
    expect(carCatalog.length).toBeGreaterThanOrEqual(30);
    const variantCount = carCatalog.reduce((n, m) => n + m.variants.length, 0);
    expect(variantCount).toBeGreaterThanOrEqual(90);
  });
});
