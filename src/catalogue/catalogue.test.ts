import { describe, expect, it } from "vitest";
import {
  catalogueBrands, catalogueModelsForBrand, catalogueVariantFor, findCatalogueModel,
  normalizeCatalogueName, vehicleCatalogue,
} from "./catalogue";

const officialHosts = [
  "cars.tatamotors.com", "hondacarindia.com", "hyundai.com", "volkswagen.co.in", "skoda-auto.co.in",
  "renault.co.in", "marutisuzuki.com", "nexaexperience.com", "kia.com", "toyotabharat.com",
  "auto.mahindra.com", "mgmotor.co.in",
];

describe("manufacturer-backed vehicle catalogue", () => {
  it("keeps model and variant identities unique and source-backed", () => {
    const modelIds = new Set<string>();
    for (const model of vehicleCatalogue) {
      expect(model.id).toBeTruthy();
      expect(modelIds.has(model.id)).toBe(false);
      modelIds.add(model.id);
      expect(model.variants.length).toBeGreaterThan(0);
      const variantIds = new Set<string>();
      for (const variant of model.variants) {
        expect(variantIds.has(variant.id)).toBe(false);
        variantIds.add(variant.id);
        expect(variant.sourceCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const source = new URL(variant.source.url);
        expect(source.protocol).toBe("https:");
        expect(officialHosts.some(host => source.hostname === host || source.hostname.endsWith(`.${host}`))).toBe(true);
      }
    }
  });

  it("filters the picker to sourced variants and resolves known aliases", () => {
    expect(catalogueBrands.length).toBeGreaterThan(0);
    expect(catalogueModelsForBrand("Tata").map(model => model.name)).toContain("Nexon");
    expect(catalogueVariantFor("Tata", "Nexon", "Smart Petrol MT")?.source.label).toBe("Tata Motors");
    expect(findCatalogueModel("Urban Cruiser Hyryder")?.name).toBe("Hyryder");
    expect(findCatalogueModel("XUV3XO")?.name).toBe("XUV 3XO");
    expect(normalizeCatalogueName("  INNOVA   HyCross ")).toBe("innova hycross");
  });
});
