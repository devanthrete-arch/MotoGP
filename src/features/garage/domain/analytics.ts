import { vehicleFuel } from "../../../core/catalog/vehicleFacts";
import { type GarageVehicle, type TimelineEntry } from "../../../core/entities";

export type TimelineCategorySpend = {
  kind: TimelineEntry["kind"];
  amount: number;
  entryCount: number;
  share: number;
};

export type TimelineMonthSpend = {
  month: string;
  amount: number;
  entryCount: number;
};

export type VehicleProfile = {
  vehicleId: string;
  name: string;
  /** `null` when the fuel type is not known — never a guess. */
  fuel: string | null;
  ageMonths: number | null;
  ownershipLabel: string;
  odometerKmPerMonth: number | null;
  loggedKm: number;
};

export type TimelineAnalytics = {
  vehicle: GarageVehicle;
  profile: VehicleProfile;
  totalSpend: number;
  entryCount: number;
  monthsCovered: number;
  averageMonthlySpend: number | null;
  costPerKm: number | null;
  byCategory: TimelineCategorySpend[];
  byMonth: TimelineMonthSpend[];
  busiestMonth: TimelineMonthSpend | null;
  largestEntry: TimelineEntry | null;
};

const monthKey = (isoDate: string): string => (isoDate || "").slice(0, 7);

/** Owner-facing profile fields the raw `GarageVehicle` record does not store. */
export function buildVehicleProfile(vehicle: GarageVehicle, timeline: TimelineEntry[], today = new Date()): VehicleProfile {
  // Fuel is never inferred from the variant string here. It is either recorded
  // on the vehicle or unambiguous in the catalog; otherwise it stays null and
  // the interface renders `PLACEHOLDER` instead of a plausible-looking guess.
  const fuel = vehicleFuel(vehicle).value;

  const purchase = /^\d{4}-\d{2}$/.test(vehicle.purchaseMonth) ? new Date(`${vehicle.purchaseMonth}-01T00:00:00.000Z`) : null;
  const ageMonths = purchase
    ? Math.max(
        0,
        (today.getUTCFullYear() - purchase.getUTCFullYear()) * 12 + (today.getUTCMonth() - purchase.getUTCMonth()),
      )
    : null;

  const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id);
  const loggedKm = entries.reduce((highest, entry) => Math.max(highest, entry.odometerKm), vehicle.odometerKm);

  return {
    ageMonths,
    fuel,
    loggedKm,
    name: vehicle.nickname || `${vehicle.brand} ${vehicle.model}`,
    odometerKmPerMonth: ageMonths && ageMonths > 0 ? loggedKm / ageMonths : null,
    ownershipLabel:
      ageMonths === null
        ? "Purchase month not set"
        : ageMonths < 12
          ? `${ageMonths} month${ageMonths === 1 ? "" : "s"} owned`
          : `${Math.floor(ageMonths / 12)} year${Math.floor(ageMonths / 12) === 1 ? "" : "s"} owned`,
    vehicleId: vehicle.id,
  };
}

/**
 * Per-vehicle running-cost analytics derived from the local timeline.
 * The hosted `garage_costs` ledger mirrors the same priced entries, so hosted
 * and local views agree; this stays usable offline and signed-out.
 */
export function buildTimelineAnalytics(
  garage: GarageVehicle[],
  timeline: TimelineEntry[],
  today = new Date(),
): TimelineAnalytics[] {
  return garage
    .map((vehicle) => {
      const entries = timeline
        .filter((entry) => entry.vehicleId === vehicle.id)
        .sort((first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn));
      const totalSpend = entries.reduce((total, entry) => total + Math.max(0, entry.amount), 0);
      const profile = buildVehicleProfile(vehicle, timeline, today);

      const categoryTotals = entries.reduce<Map<TimelineEntry["kind"], { amount: number; entryCount: number }>>(
        (totals, entry) => {
          const current = totals.get(entry.kind) ?? { amount: 0, entryCount: 0 };
          totals.set(entry.kind, { amount: current.amount + Math.max(0, entry.amount), entryCount: current.entryCount + 1 });
          return totals;
        },
        new Map(),
      );

      const byCategory = [...categoryTotals.entries()]
        .map<TimelineCategorySpend>(([kind, value]) => ({
          amount: value.amount,
          entryCount: value.entryCount,
          kind,
          share: totalSpend > 0 ? value.amount / totalSpend : 0,
        }))
        .sort((first, second) => second.amount - first.amount || first.kind.localeCompare(second.kind));

      const monthTotals = entries.reduce<Map<string, { amount: number; entryCount: number }>>((totals, entry) => {
        const key = monthKey(entry.happenedOn);
        if (!key) return totals;
        const current = totals.get(key) ?? { amount: 0, entryCount: 0 };
        totals.set(key, { amount: current.amount + Math.max(0, entry.amount), entryCount: current.entryCount + 1 });
        return totals;
      }, new Map());

      const byMonth = [...monthTotals.entries()]
        .map<TimelineMonthSpend>(([month, value]) => ({ amount: value.amount, entryCount: value.entryCount, month }))
        .sort((first, second) => first.month.localeCompare(second.month));

      const busiestMonth =
        [...byMonth].sort((first, second) => second.amount - first.amount || second.month.localeCompare(first.month))[0] ?? null;

      const usableKm = Math.max(vehicle.odometerKm, profile.loggedKm);

      return {
        averageMonthlySpend: byMonth.length ? totalSpend / byMonth.length : null,
        busiestMonth,
        byCategory,
        byMonth,
        costPerKm: usableKm > 0 && totalSpend > 0 ? totalSpend / usableKm : null,
        entryCount: entries.length,
        largestEntry: [...entries].sort((first, second) => second.amount - first.amount)[0] ?? null,
        monthsCovered: byMonth.length,
        profile,
        totalSpend,
        vehicle,
      };
    })
    .sort((first, second) => second.totalSpend - first.totalSpend || first.vehicle.id.localeCompare(second.vehicle.id));
}
