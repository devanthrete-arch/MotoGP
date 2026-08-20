import { type GarageVehicle, type TimelineEntry } from "../../../core/entities";

export type GarageCostLedger = {
  vehicle: GarageVehicle;
  totalSpend: number;
  entryCount: number;
  costPerKm: number | null;
  latestEntry: TimelineEntry | null;
  highestLoggedOdometerKm: number;
};

export function buildGarageCostLedger(garage: GarageVehicle[], timeline: TimelineEntry[]): GarageCostLedger[] {
  return garage
    .map((vehicle) => {
      const entries = timeline
        .filter((entry) => entry.vehicleId === vehicle.id)
        .sort((first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn));
      const totalSpend = entries.reduce((total, entry) => total + entry.amount, 0);
      const highestLoggedOdometerKm = entries.reduce((highest, entry) => Math.max(highest, entry.odometerKm), vehicle.odometerKm);
      const usableKm = Math.max(vehicle.odometerKm, highestLoggedOdometerKm);

      return {
        costPerKm: usableKm > 0 && totalSpend > 0 ? totalSpend / usableKm : null,
        entryCount: entries.length,
        highestLoggedOdometerKm,
        latestEntry: entries[0] ?? null,
        totalSpend,
        vehicle,
      };
    })
    .sort((first, second) => second.totalSpend - first.totalSpend || first.vehicle.nickname.localeCompare(second.vehicle.nickname));
}
