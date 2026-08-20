import type { GarageVehicle } from "../core/entities";
import { vehicleFactRows } from "../core/catalog/vehicleFacts";
import { FactPair } from "./primitives";

const sourceHint: Record<string, string> = {
  catalog: "Every variant of this model shares this value.",
  recorded: "Recorded by you on this vehicle.",
  unknown: "Not recorded yet — edit the vehicle to set it.",
};

/**
 * Variant, fuel, transmission and ownership as four separate labelled fields.
 *
 * These never get folded into a vehicle title: a title has to read as a fact,
 * and three of these four are frequently unknown. Unknown values render in the
 * dimmer `outline` tone so a blank never looks like a confirmed spec.
 */
export function VehicleFactGrid({ vehicle, className = "" }: { vehicle: GarageVehicle; className?: string }) {
  return (
    <div aria-label="Vehicle details" className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`} role="group">
      {vehicleFactRows(vehicle).map((row) => (
        <div
          className="flex flex-col gap-1.5 p-3 rounded bg-surface-container-lowest/60 border border-outline-variant/40"
          key={row.label}
        >
          <FactPair
            label={row.label}
            muted={row.fact.source === "unknown"}
            title={sourceHint[row.fact.source]}
            value={row.fact.label}
          />
        </div>
      ))}
    </div>
  );
}
