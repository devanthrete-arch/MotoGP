import { verifiedComparisonFor } from "../comparisonCatalog";
import { modelPriceOptions } from "../app/model";

export type CatalogueVariant = {
  id: string;
  name: string;
  source: { label: string; url: string };
  sourceCheckedOn: string;
};

export type CatalogueModel = {
  id: string;
  brand: string;
  name: string;
  aliases: readonly string[];
  variants: readonly CatalogueVariant[];
  generationStatus: "manual";
};

const sourceCheckedOn = "2026-10-09";
const modelAliases: Record<string, readonly string[]> = {
  "Toyota|Innova Hycross": ["Innova HyCross", "Innova Hycross"],
  "Toyota|Hyryder": ["Urban Cruiser Hyryder", "Urban Cruiser HyRyder"],
  "Mahindra|XUV 3XO": ["XUV3XO", "XUV 3XO"],
  "Maruti Suzuki|Grand Vitara": ["Grand-Vitara"],
};

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const verifiedCatalogueEntries = modelPriceOptions.flatMap(({ brand, model, variants }) => variants.flatMap(({ name }) => {
  const record = verifiedComparisonFor(brand, model, name);
  return record ? [{ brand, model, variant: name, source: record.source }] : [];
}));

const modelMap = new Map<string, CatalogueModel>();
for (const entry of verifiedCatalogueEntries) {
  const key = `${entry.brand}|${entry.model}`;
  const id = slug(key);
  const model = modelMap.get(key) ?? {
    id,
    brand: entry.brand,
    name: entry.model,
    aliases: modelAliases[key] ?? [],
    variants: [],
    generationStatus: "manual" as const,
  };
  modelMap.set(key, {
    ...model,
    variants: [...model.variants, {
      id: `${id}:${slug(entry.variant)}`,
      name: entry.variant,
      source: entry.source,
      sourceCheckedOn,
    }],
  });
}

export const vehicleCatalogue = [...modelMap.values()]
  .map(model => ({ ...model, variants: [...model.variants].sort((a, b) => a.name.localeCompare(b.name)) }))
  .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

export const catalogueBrands = [...new Set(vehicleCatalogue.map(model => model.brand))];

export const catalogueModelsForBrand = (brand: string) => vehicleCatalogue.filter(model => model.brand === brand);

export const catalogueVariantsForModel = (brand: string, model: string) =>
  vehicleCatalogue.find(entry => entry.brand === brand && entry.name === model)?.variants ?? [];

export const catalogueVariantFor = (brand: string, model: string, variant: string) =>
  catalogueVariantsForModel(brand, model).find(entry => entry.name === variant);

export const normalizeCatalogueName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");

export const findCatalogueModel = (value: string, brand?: string) => {
  const normalized = normalizeCatalogueName(value);
  const normalizedBrand = brand ? normalizeCatalogueName(brand) : undefined;
  return vehicleCatalogue.find(model => (!normalizedBrand || normalizeCatalogueName(model.brand) === normalizedBrand)
    && [model.name, ...model.aliases].some(alias => normalizeCatalogueName(alias) === normalized));
};
