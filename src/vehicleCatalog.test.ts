import { describe, expect, it } from "vitest";
import { modelsForBrand, vehicleBrands } from "./vehicleCatalog";

describe("vehicle catalog", () => {
  it("offers MG Hector in car flows", () => {
    expect(vehicleBrands).toContain("MG");
    expect(modelsForBrand("MG")).toContain("Hector");
  });

  it("keeps unsupported brands open to custom model entry", () => {
    expect(modelsForBrand("Tata")).toEqual([]);
  });
});
