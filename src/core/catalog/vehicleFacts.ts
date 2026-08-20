import { findModel } from "./carData";
import type { GarageVehicle, VehicleFuel, VehicleOwnership, VehicleTransmission } from "../entities";

/**
 * Vehicle metadata the interface is allowed to display.
 *
 * The previous implementation guessed fuel by substring-matching the variant
 * string ("XZ+ Diesel MT" -> Diesel) and fell back to "Petrol" when nothing
 * matched — so an unverified guess was rendered exactly like a confirmed fact.
 * These helpers only ever return a value that is either recorded on the vehicle
 * or unambiguous in the catalog, and report which of the two it was.
 */
export type FactSource = "recorded" | "catalog" | "unknown";

export type VehicleFact<Value extends string> = {
  /** Display string. `PLACEHOLDER` when nothing is known. */
  label: string;
  source: FactSource;
  value: Value | null;
};

/** Shown instead of inventing a value. */
export const PLACEHOLDER = "Not set";

const known = <Value extends string>(value: Value, source: FactSource): VehicleFact<Value> => ({
  label: value,
  source,
  value,
});

const unknown = <Value extends string>(): VehicleFact<Value> => ({
  label: PLACEHOLDER,
  source: "unknown",
  value: null,
});

/**
 * A catalog lookup only counts when every variant of the model shares one
 * value. A Nexon sold as petrol, diesel, CNG and EV tells us nothing about
 * which one sits in this owner's garage.
 */
const unambiguousCatalogValue = <Value extends string>(
  vehicle: GarageVehicle,
  read: (variant: NonNullable<ReturnType<typeof findModel>>["variants"][number]) => Value,
): Value | null => {
  const model = findModel(vehicle.brand, vehicle.model);
  if (!model?.variants.length) return null;
  const values = new Set(model.variants.map(read));
  return values.size === 1 ? ([...values][0] as Value) : null;
};

export const vehicleFuel = (vehicle: GarageVehicle): VehicleFact<VehicleFuel> => {
  if (vehicle.fuel) return known(vehicle.fuel, "recorded");
  const inferred = unambiguousCatalogValue<VehicleFuel>(vehicle, (variant) => variant.fuel);
  return inferred ? known(inferred, "catalog") : unknown<VehicleFuel>();
};

export const vehicleTransmission = (vehicle: GarageVehicle): VehicleFact<VehicleTransmission> => {
  if (vehicle.transmission) return known(vehicle.transmission, "recorded");
  const inferred = unambiguousCatalogValue<VehicleTransmission>(vehicle, (variant) => variant.transmission);
  return inferred ? known(inferred, "catalog") : unknown<VehicleTransmission>();
};

export const vehicleOwnership = (vehicle: GarageVehicle): VehicleFact<VehicleOwnership> =>
  vehicle.ownership ? known(vehicle.ownership, "recorded") : unknown<VehicleOwnership>();

export const vehicleVariantLabel = (vehicle: GarageVehicle): string => vehicle.variant.trim() || PLACEHOLDER;

/**
 * Title line for a vehicle: brand, model and trim only.
 *
 * Fuel and transmission are deliberately excluded — they are shown as their own
 * labelled fields so a reader can tell a recorded fact from a blank.
 */
export const vehicleTitle = (vehicle: GarageVehicle): string => {
  const trim = vehicle.variant.trim();
  const base = `${vehicle.brand} ${vehicle.model}`.trim();
  return trim ? `${base} • ${trim}` : base;
};

/** Label/value pairs for the metadata block, in a stable reading order. */
export const vehicleFactRows = (vehicle: GarageVehicle): Array<{ label: string; fact: VehicleFact<string> }> => [
  { fact: { label: vehicleVariantLabel(vehicle), source: vehicle.variant ? "recorded" : "unknown", value: vehicle.variant || null }, label: "Variant" },
  { fact: vehicleFuel(vehicle), label: "Fuel" },
  { fact: vehicleTransmission(vehicle), label: "Transmission" },
  { fact: vehicleOwnership(vehicle), label: "Ownership" },
];
