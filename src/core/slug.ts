import { modelKeyFor } from "./identity";

/**
 * URL-safe slug value objects.
 *
 * These live in `core` because three layers agree on them: the app builds
 * canonical share links from them, the content feature keys local city circles
 * by them to dedupe against hosted rows, and every one of them is a pure
 * string derivation with no browser or network dependency.
 */
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Returns the candidate only when it is already a well-formed slug. */
export const safeSlug = (candidate: string | undefined): string | null => {
  const value = (candidate ?? "").trim();
  return slugPattern.test(value) ? value : null;
};

/** Model slug for `/cars/:slug` and `/playbooks/:slug`. Identical to `modelKeyFor`. */
export const modelSlugFor = (brand: string | undefined, model: string | undefined): string | null =>
  safeSlug(modelKeyFor((brand ?? "").trim(), (model ?? "").trim()));

export const citySlugFor = (city: string | undefined): string | null => safeSlug(slugify((city ?? "").trim()));
