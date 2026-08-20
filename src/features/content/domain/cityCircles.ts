import { type GarageVehicle, type KnowledgeLabel, type OwnerPost } from "../../../core/entities";
import { type CityCircle } from "../../../core/projections";
import { topValues } from "./topValues";

export function buildCityCircles(posts: OwnerPost[], garage: GarageVehicle[]): CityCircle[] {
  const cityNames = new Set(
    [...posts.map((post) => post.city), ...garage.map((vehicle) => vehicle.city)]
      .map((city) => city.trim())
      .filter(Boolean),
  );

  return [...cityNames]
    .map((city) => {
      const cityPosts = posts.filter((post) => post.city.trim().toLowerCase() === city.toLowerCase());
      const cityGarage = garage.filter((vehicle) => vehicle.city.trim().toLowerCase() === city.toLowerCase());
      const topBrands = topValues(cityPosts.map((post) => post.brand), 3);
      const hotTopics = topValues(cityPosts.map((post) => post.label), 3) as KnowledgeLabel[];
      const activityScore = cityPosts.length + cityGarage.length;
      const localSignal: CityCircle["localSignal"] = activityScore >= 4 ? "Hot" : activityScore >= 2 ? "Active" : "Quiet";

      return {
        city,
        garageVehicles: cityGarage,
        hotTopics,
        localSignal,
        posts: cityPosts,
        topBrands,
      };
    })
    .sort((first, second) => second.posts.length + second.garageVehicles.length - (first.posts.length + first.garageVehicles.length));
}
