import type { GarageVehicle, KnowledgeLabel, OwnerPost } from "../../core/entities";
import { PUBLIC_LIST_LIMIT } from "./kernel/limits";
import { knowledgeLabels } from "../../core/entities";
import type { CityCircle } from "../../insights";
import { CACHE_TTL, invalidateHostedNamespace, publicKey, readThroughCache } from "./kernel/cache";
import { asCount, asStringList, asText, slugify } from "./kernel/coerce";
import { asOneOf } from "./kernel/coerce";
import { type HostedClient, runHosted, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { CityCircleRow, Insert } from "../supabase/tables";

export const localSignalValues = ["Quiet", "Active", "Hot"] as const;

export type HostedCitySignal = (typeof localSignalValues)[number];

/** Row-shaped city page; `CityCircle` keeps the post/vehicle arrays the UI needs. */
export type HostedCityCircle = {
  slug: string;
  city: string;
  state: string;
  headline: string;
  summary: string;
  localSignal: HostedCitySignal;
  topBrands: string[];
  hotTopics: KnowledgeLabel[];
  postCount: number;
  garageCount: number;
};

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const cityRowToHosted = (row: CityCircleRow): HostedCityCircle => ({
  city: asText(row.city),
  garageCount: asCount(row.garage_count),
  headline: asText(row.headline),
  hotTopics: asStringList(row.hot_topics)
    .map((topic) => asOneOf<KnowledgeLabel>(topic, knowledgeLabels, "Owner note"))
    .filter((topic, index, all) => all.indexOf(topic) === index),
  localSignal: asOneOf<HostedCitySignal>(row.local_signal, localSignalValues, "Quiet"),
  postCount: asCount(row.post_count),
  slug: asText(row.slug),
  state: asText(row.state),
  summary: asText(row.summary),
  topBrands: asStringList(row.top_brands),
});

export const cityCircleToHosted = (circle: CityCircle): HostedCityCircle => ({
  city: asText(circle.city),
  garageCount: circle.garageVehicles.length,
  headline: "",
  hotTopics: circle.hotTopics.map((topic) => asOneOf<KnowledgeLabel>(topic, knowledgeLabels, "Owner note")),
  localSignal: asOneOf<HostedCitySignal>(circle.localSignal, localSignalValues, "Quiet"),
  postCount: circle.posts.length,
  slug: slugify(asText(circle.city)),
  state: "",
  summary: "",
  topBrands: asStringList(circle.topBrands),
});

export const hostedCityToRow = (userId: string | null, city: HostedCityCircle): Insert<"city_circles"> => ({
  city: asText(city.city, "Unknown"),
  curated_by: userId,
  garage_count: asCount(city.garageCount),
  headline: asText(city.headline).slice(0, 180),
  hot_topics: city.hotTopics.map((topic) => asText(topic)),
  local_signal: asOneOf<HostedCitySignal>(city.localSignal, localSignalValues, "Quiet"),
  post_count: asCount(city.postCount),
  slug: slugify(asText(city.slug) || asText(city.city)),
  state: asText(city.state).slice(0, 100),
  summary: asText(city.summary).slice(0, 4000),
  top_brands: asStringList(city.topBrands),
});

/**
 * Hosted city page → the local `CityCircle` shape, rehydrating the post and
 * vehicle arrays from whatever the app already holds locally.
 */
export const hostedCityToLocal = (
  city: HostedCityCircle,
  posts: OwnerPost[] = [],
  garage: GarageVehicle[] = [],
): CityCircle => {
  const key = city.city.trim().toLowerCase();
  const cityPosts = posts.filter((post) => post.city.trim().toLowerCase() === key);
  const cityGarage = garage.filter((vehicle) => vehicle.city.trim().toLowerCase() === key);
  return {
    city: city.city,
    garageVehicles: cityGarage,
    hotTopics: city.hotTopics,
    localSignal: city.localSignal,
    posts: cityPosts,
    topBrands: city.topBrands,
  };
};

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectCityCircleRows = async (client: HostedClient): Promise<CityCircleRow[]> =>
  unwrap(
    await client
      .from("city_circles")
      .select("*")
      .order("post_count", { ascending: false })
      .limit(PUBLIC_LIST_LIMIT),
    [],
  );

/**
 * Public read: `city_circles` is anon-readable, so this works signed-out and is
 * safe to cache under a shared public key — every visitor sees the same rows.
 */
export const listHostedCityCircles = (fallback: HostedCityCircle[] = []) =>
  readThroughCache<HostedCityCircle[]>(
    publicKey("city-circles", "all"),
    fallback,
    () =>
      runHosted<HostedCityCircle[]>(fallback, async (client) =>
        (await selectCityCircleRows(client)).map(cityRowToHosted),
      ),
    CACHE_TTL.cityCircles,
  );

export const loadHostedCityCircle = (citySlug: string, fallback: HostedCityCircle | null = null) =>
  readThroughCache<HostedCityCircle | null>(
    publicKey("city-circles", slugify(citySlug)),
    fallback,
    () =>
      runHosted<HostedCityCircle | null>(fallback, async (client) => {
        const row = unwrap(
          await client.from("city_circles").select("*").eq("slug", slugify(citySlug)).maybeSingle(),
          null,
        );
        return row ? cityRowToHosted(row) : fallback;
      }),
    CACHE_TTL.cityCircles,
  );

export const upsertHostedCityCircles = (userId: string | null | undefined, cities: HostedCityCircle[]) =>
  runHostedForUser<HostedCityCircle[]>(userId, cities, async (client, id) => {
    const rows = cities.map((city) => hostedCityToRow(id, city)).filter((row) => Boolean(row.slug));
    if (!rows.length) return cities;
    unwrapWrite(await client.from("city_circles").upsert(rows, { onConflict: "slug" }));
    // A curator just changed what everyone reads: drop the shared entries so the
    // next reader pulls fresh rows rather than waiting out the TTL.
    invalidateHostedNamespace("city-circles");
    return cities;
  });

/** Bulk publish of locally derived `buildCityCircles()` output. */
export const publishHostedCityCircles = (userId: string | null | undefined, circles: CityCircle[]) =>
  upsertHostedCityCircles(userId, circles.map(cityCircleToHosted));
