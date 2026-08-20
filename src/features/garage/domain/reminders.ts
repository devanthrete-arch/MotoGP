import { type GarageVehicle, type TimelineEntry } from "../../../core/entities";
import { type GarageReminder } from "../../../core/projections";

export function buildGarageReminders(garage: GarageVehicle[], timeline: TimelineEntry[], today = new Date()): GarageReminder[] {
  return garage.flatMap((vehicle) => {
    const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id);
    const vehicleName = vehicle.nickname || `${vehicle.brand} ${vehicle.model}`;
    const nextServiceKm = Math.ceil((vehicle.odometerKm + 1) / 10000) * 10000;
    const kmToService = Math.max(0, nextServiceKm - vehicle.odometerKm);
    const latestInsurance = latestEntryOfKind(entries, "Insurance");
    const latestTyres = latestEntryOfKind(entries, "Tyres");

    return [
      kmToService <= 1500
        ? {
            detail: `${kmToService.toLocaleString("en-IN")} km left before the ${nextServiceKm.toLocaleString("en-IN")} km checkpoint.`,
            id: `${vehicle.id}-service-reminder`,
            title: "Plan the next service visit",
            urgency: kmToService <= 500 ? ("Soon" as const) : ("Plan" as const),
            vehicleId: vehicle.id,
            vehicleName,
          }
        : null,
      latestInsurance
        ? insuranceReminder(vehicle, vehicleName, latestInsurance, today)
        : {
            detail: "No insurance note is logged yet. Add renewal date, premium, and claim details when available.",
            id: `${vehicle.id}-insurance-missing`,
            title: "Log insurance renewal details",
            urgency: "Plan" as const,
            vehicleId: vehicle.id,
            vehicleName,
          },
      latestTyres && vehicle.odometerKm - latestTyres.odometerKm >= 35000
        ? {
            detail: `${(vehicle.odometerKm - latestTyres.odometerKm).toLocaleString("en-IN")} km since the last tyre note.`,
            id: `${vehicle.id}-tyre-watch`,
            title: "Inspect tyre age and wear",
            urgency: "Watch" as const,
            vehicleId: vehicle.id,
            vehicleName,
          }
        : null,
    ].filter((reminder): reminder is GarageReminder => Boolean(reminder));
  });
}

function latestEntryOfKind(entries: TimelineEntry[], kind: TimelineEntry["kind"]): TimelineEntry | null {
  return (
    entries
      .filter((entry) => entry.kind === kind)
      .sort((first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn))[0] ?? null
  );
}

function insuranceReminder(
  vehicle: GarageVehicle,
  vehicleName: string,
  latestInsurance: TimelineEntry,
  today: Date,
): GarageReminder | null {
  const renewalDate = new Date(latestInsurance.happenedOn);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const daysToRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / 86_400_000);

  if (daysToRenewal > 45) return null;

  return {
    detail:
      daysToRenewal >= 0
        ? `${daysToRenewal} day${daysToRenewal === 1 ? "" : "s"} left before the logged insurance renewal window.`
        : `${Math.abs(daysToRenewal)} day${daysToRenewal === -1 ? "" : "s"} past the logged insurance renewal window.`,
    id: `${vehicle.id}-insurance-renewal`,
    title: "Review insurance renewal",
    urgency: daysToRenewal <= 15 ? "Soon" : "Plan",
    vehicleId: vehicle.id,
    vehicleName,
  };
}
