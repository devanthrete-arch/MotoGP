import { describe, expect, it } from "vitest";
import {
  catalogueBrands, catalogueModelsForBrand, catalogueVariantFor, findCatalogueModel,
  normalizeCatalogueName, vehicleCatalogue,
} from "./catalogue";
import { indiaLineup, requestedMakes } from "./indiaLineup";

const officialHosts = [
  "cars.tatamotors.com", "hondacarindia.com", "hyundai.com", "volkswagen.co.in", "skoda-auto.co.in",
  "renault.co.in", "marutisuzuki.com", "nexaexperience.com", "kia.com", "toyotabharat.com",
  "auto.mahindra.com", "mgmotor.co.in", "heromotocorp.com", "honda2wheelersindia.com",
  "tvsmotor.com", "bajajauto.com", "royalenfield.com",
];

describe("manufacturer-backed vehicle catalogue", () => {
  it("keeps model and variant identities unique and source-backed", () => {
    const modelIds = new Set<string>();
    for (const model of vehicleCatalogue) {
      expect(model.id).toBeTruthy();
      expect(modelIds.has(model.id)).toBe(false);
      modelIds.add(model.id);
      const variantIds = new Set<string>();
      for (const variant of model.variants) {
        expect(variantIds.has(variant.id)).toBe(false);
        variantIds.add(variant.id);
        if (variant.sourceCheckedOn) {
          expect(variant.sourceCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(Date.parse(`${variant.sourceCheckedOn}T00:00:00Z`)).toBeLessThanOrEqual(Date.now());
        }
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

  it("covers the requested current India lineups with official sources and stable identities", () => {
    expect(new Set(indiaLineup.map(model => model.brand))).toEqual(new Set(requestedMakes));
    const keys = new Set<string>();
    for (const model of indiaLineup) {
      const key = `${model.brand}|${model.model}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      expect(model.source.checkedOn).toBe("2026-10-10");
      const official = new URL(model.source.url);
      expect(official.protocol).toBe("https:");
      expect(officialHosts.some(host => official.hostname === host || official.hostname.endsWith(`.${host}`))).toBe(true);
      expect(vehicleCatalogue.some(item => item.brand === model.brand && item.name === model.model)).toBe(true);
    }
    expect(indiaLineup.filter(model => model.kind === "two-wheeler").length).toBeGreaterThan(70);
    expect(indiaLineup.some(model => model.status === "pre-booking")).toBe(true);
  });
});
