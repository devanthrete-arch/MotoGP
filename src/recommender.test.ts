import { describe, expect, it } from "vitest";
import { rankCars, type RecommenderCandidate, type RecommenderPreferences } from "./recommender";

const source = { label: "Official test record", url: "https://example.com/vehicle", checkedOn: "2026-10-09" };
const fact = <T,>(value: T) => ({ value, source });
const preferences: RecommenderPreferences = {
  state: "Delhi", localityTier: "metro", budgetRupees: 1_500_000, monthlyKm: 1_000,
  fuel: "Petrol", firstCar: true, fuelPricePerLitre: 100,
};
const complete = (overrides: Partial<RecommenderCandidate> = {}): RecommenderCandidate => ({
  id: "car-a", brand: "Example", model: "A", variant: "Base petrol MT", fuel: "Petrol",
  source: fact({}), prices: { Delhi: fact(1_200_000) }, consumption: fact(18), consumptionUnit: "km-per-litre",
  serviceSchedule: fact([{ intervalKm: 5_000, visitCostRupees: 3_500 }]),
  serviceCoverage: fact({ metro: 0.9, urban: 0.7 }),
  firstCarFit: fact(0.8), safetyRatingOutOfFive: fact(4),
  ...overrides,
});

describe("recommender ranking", () => {
  it("ranks only fully sourced exact variants within the selected budget and state", () => {
    const result = rankCars([complete(), complete({ id: "missing-price", prices: {} })], preferences, "2026-10-09");
    expect(result.recommendations.map(item => item.candidate.id)).toEqual(["car-a"]);
    expect(result.notEnoughVerifiedData).toEqual(["missing-price"]);
  });

  it("filters incompatible fuel, missing local support and over-budget cars", () => {
    const result = rankCars([
      complete({ id: "diesel", fuel: "Diesel" }),
      complete({ id: "unsupported", serviceCoverage: fact({ metro: 0 }) }),
      complete({ id: "over", prices: { Delhi: fact(1_600_000) } }),
    ], preferences, "2026-10-09");
    expect(result.recommendations).toEqual([]);
    expect(result.excluded).toEqual({ fuel: ["diesel"], locality: ["unsupported"], budget: ["over"] });
  });

  it("explains monthly fuel and scheduled service costs without inventing inputs", () => {
    const [recommendation] = rankCars([complete()], preferences, "2026-10-09").recommendations;
    expect(recommendation.monthlyEnergyRupees).toBeCloseTo(5_555.56, 2);
    expect(recommendation.monthlyServiceRupees).toBeCloseTo(583.33, 2);
    expect(rankCars([complete()], { ...preferences, fuelPricePerLitre: undefined }, "2026-10-09").recommendations).toEqual([]);
  });

  it("uses the user's CNG or electricity rate and the matching efficiency unit", () => {
    const cng = rankCars([complete({ fuel: "CNG", consumption: fact(20), consumptionUnit: "km-per-kg" })], {
      ...preferences, fuel: "CNG", fuelPricePerKg: 70,
    }, "2026-10-09").recommendations[0];
    const electric = rankCars([complete({ fuel: "Electric", consumption: fact(15), consumptionUnit: "kwh-per-100km" })], {
      ...preferences, fuel: "Electric", electricityPricePerKwh: 8,
    }, "2026-10-09").recommendations[0];
    expect(cng.monthlyEnergyRupees).toBe(3_500);
    expect(electric.monthlyEnergyRupees).toBe(1_200);
  });

  it("rejects invalid or stale facts instead of ranking them", () => {
    const result = rankCars([
      complete({ id: "bad-url", prices: { Delhi: { value: 1_200_000, source: { ...source, url: "javascript:alert(1)" } } } }),
      complete({ id: "bad-date", prices: { Delhi: { value: 1_200_000, source: { ...source, checkedOn: "2025-10-08" } } } }),
      complete({ id: "malformed-date", prices: { Delhi: { value: 1_200_000, source: { ...source, checkedOn: "2026-02-31" } } } }),
      complete({ id: "bad-efficiency", consumption: fact(0) }),
    ], preferences, "2026-10-09");
    expect(result.recommendations).toEqual([]);
    expect(result.notEnoughVerifiedData).toEqual(["bad-date", "bad-efficiency", "bad-url", "malformed-date"]);
  });

  it("does not substitute another state's price when the selected state is missing", () => {
    const result = rankCars([complete({ prices: { Maharashtra: fact(1_200_000) } })], preferences, "2026-10-09");
    expect(result.recommendations).toEqual([]);
    expect(result.notEnoughVerifiedData).toEqual(["car-a"]);
  });

  it("sorts by explained fit score and breaks ties deterministically", () => {
    const result = rankCars([
      complete({ id: "b", model: "B", firstCarFit: fact(0.7) }),
      complete({ id: "a", model: "A", firstCarFit: fact(0.7) }),
      complete({ id: "best", model: "Best", consumption: fact(24), serviceSchedule: fact([{ intervalKm: 5_000, visitCostRupees: 2_000 }]), firstCarFit: fact(1), safetyRatingOutOfFive: fact(5) }),
    ], preferences, "2026-10-09");
    expect(result.recommendations[0].candidate.id).toBe("best");
    expect(result.recommendations.slice(1).map(item => item.candidate.id)).toEqual(["a", "b"]);
    expect(result.recommendations.every(item => item.reasons.length > 0)).toBe(true);
  });
});
