import { type GarageVehicle, type OwnerPost, type TimelineEntry } from "../../../core/entities";
import { modelKeyFor } from "../../../core/identity";
import { formatMoney } from "../../../core/money";

export type GarageInsight = {
  id: string;
  title: string;
  detail: string;
  tone: "service" | "cost" | "community";
};

export function buildGarageInsights(garage: GarageVehicle[], timeline: TimelineEntry[], posts: OwnerPost[]): GarageInsight[] {
  return garage.flatMap((vehicle) => {
    const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id);
    const totalSpend = entries.reduce((total, entry) => total + entry.amount, 0);
    const matchingPosts = posts.filter(
      (post) => modelKeyFor(post.brand, post.model) === modelKeyFor(vehicle.brand, vehicle.model),
    );
    const nextServiceKm = Math.ceil((vehicle.odometerKm + 1) / 10000) * 10000;

    return [
      {
        id: `${vehicle.id}-service`,
        title: `${vehicle.nickname || vehicle.model}: next checkpoint`,
        detail: `${Math.max(0, nextServiceKm - vehicle.odometerKm).toLocaleString("en-IN")} km to the next 10k service marker.`,
        tone: "service" as const,
      },
      {
        id: `${vehicle.id}-cost`,
        title: `${vehicle.nickname || vehicle.model}: logged spend`,
        detail: totalSpend
          ? `${formatMoney(totalSpend)} captured across ${entries.length} timeline note${entries.length === 1 ? "" : "s"}.`
          : "No spend logged yet. Add service, repair, tyre, insurance, or fuel notes.",
        tone: "cost" as const,
      },
      {
        id: `${vehicle.id}-community`,
        title: `${vehicle.model}: community context`,
        detail: `${matchingPosts.length} related ownership note${matchingPosts.length === 1 ? "" : "s"} available in model notebooks.`,
        tone: "community" as const,
      },
    ];
  });
}
