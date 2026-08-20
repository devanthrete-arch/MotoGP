import { useMemo } from "react";
import { type CityCircle, type GarageVehicle, type OwnerPost, type OwnershipPlaybook } from "../../../core";
import { type HostedCityCircle } from "../../../infrastructure/hosted";
import { citySlugFor } from "../../../core/slug";
import { buildCityCircles } from "../domain/cityCircles";
import { buildOwnershipPlaybooks } from "../domain/playbooks";

/**
 * City circles and ownership playbooks: the two read-only content surfaces
 * built from owner posts. Local derivation wins on shape; hosted rows only add
 * cities and models this device has never seen.
 */
export function useContentDerived({
  garage,
  hostedCities,
  hostedPlaybooks,
  posts,
}: {
  garage: GarageVehicle[];
  hostedCities: HostedCityCircle[];
  hostedPlaybooks: OwnershipPlaybook[];
  posts: OwnerPost[];
}) {
  /** Local city circles, enriched with the hosted page copy when it exists. */
  const cityCircles = useMemo(() => {
    const local = buildCityCircles(posts, garage);
    if (!hostedCities.length) return local;
    const localBySlug = new Map(local.map((circle) => [citySlugFor(circle.city) ?? "", circle]));
    const extras = hostedCities
      .filter((city) => city.slug && !localBySlug.has(city.slug))
      .map<CityCircle>((city) => ({
        city: city.city,
        garageVehicles: [],
        hotTopics: city.hotTopics,
        localSignal: city.localSignal,
        posts: [],
        topBrands: city.topBrands,
      }));
    return [...local, ...extras];
  }, [garage, hostedCities, posts]);

  const hostedCityBySlug = useMemo(() => new Map(hostedCities.map((city) => [city.slug, city])), [hostedCities]);

  /** Local playbooks win on shape; hosted rows add models this device has never seen. */
  const ownershipPlaybooks = useMemo(() => {
    const local = buildOwnershipPlaybooks(posts);
    if (!hostedPlaybooks.length) return local;
    const localKeys = new Set(local.map((playbook) => playbook.key));
    return [...local, ...hostedPlaybooks.filter((playbook) => !localKeys.has(playbook.key))];
  }, [hostedPlaybooks, posts]);

  return {
    cityCircles,
    hostedCityBySlug,
    ownershipPlaybooks,
  };
}
