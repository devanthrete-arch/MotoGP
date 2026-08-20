import { vehicleFactRows } from "../../../core/catalog/vehicleFacts";
import { type GarageVehicle, type TimelineEntry } from "../../../core/entities";
import { formatMoney } from "../../../core/money";

export function buildGarageExportMarkdown(garage: GarageVehicle[], timeline: TimelineEntry[]): string {
  if (!garage.length) return "# Autoflex garage\n\nNo vehicles saved yet.";

  return [
    "# Autoflex garage export",
    "",
    ...garage.flatMap((vehicle) => {
      const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id);
      return [
        `## ${vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}`,
        "",
        `- Vehicle: ${vehicle.brand} ${vehicle.model}`,
        // Each detail is its own labelled line, and an unrecorded one exports as
        // the placeholder — a reader of the export can tell facts from blanks.
        ...vehicleFactRows(vehicle).map((row) => `- ${row.label}: ${row.fact.label}`),
        `- City: ${vehicle.city || "Not shared"}`,
        `- Odometer: ${vehicle.odometerKm.toLocaleString("en-IN")} km`,
        `- Purchase month: ${vehicle.purchaseMonth || "Not shared"}`,
        "",
        "### Timeline",
        "",
        ...(entries.length
          ? entries.map(
              (entry) =>
                `- ${entry.happenedOn}: ${entry.kind} — ${entry.title} (${formatMoney(entry.amount)}, ${entry.odometerKm.toLocaleString(
                  "en-IN",
                )} km). ${entry.note}`,
            )
          : ["- No timeline notes yet."]),
        "",
      ];
    }),
  ].join("\n");
}
