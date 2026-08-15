import { describe, expect, it } from "vitest";
import { modelsForBrand, vehicleBrands } from "./vehicleCatalog";

describe("vehicle catalog", () => {
  it("offers MG Hector in car flows", () => {
    expect(vehicleBrands).toContain("MG");
    expect(modelsForBrand("MG")).toContain("Hector");
  });

  it("keeps unsupported brands open to custom model entry", () => {
    expect(modelsForBrand("Rolls-Royce")).toEqual([]);
    expect(modelsForBrand("")).toEqual([]);
  });

  it("has a non-empty model list for every supported brand", () => {
    for (const brand of vehicleBrands) {
      const models = modelsForBrand(brand);
      expect(models.length, `brand ${brand} should list models`).toBeGreaterThan(0);
    }
  });

  it("lists current flagship models for key brands", () => {
    expect(modelsForBrand("Tata")).toContain("Nexon");
    expect(modelsForBrand("Maruti Suzuki")).toContain("Swift");
    expect(modelsForBrand("Mahindra")).toContain("XUV700");
    expect(modelsForBrand("Hyundai")).toContain("Creta");
    expect(modelsForBrand("Toyota")).toContain("Fortuner");
    expect(modelsForBrand("Kia")).toContain("Seltos");
    expect(modelsForBrand("Skoda")).toContain("Kylaq");
    expect(modelsForBrand("Volkswagen")).toContain("Virtus");
    expect(modelsForBrand("Honda")).toContain("City");
    expect(modelsForBrand("MG")).toContain("Windsor EV");
  });

  it("has no duplicate models within a brand", () => {
    for (const brand of vehicleBrands) {
      const models = modelsForBrand(brand);
      expect(new Set(models).size).toBe(models.length);
    }
  });
});
