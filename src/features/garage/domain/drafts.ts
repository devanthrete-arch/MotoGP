import { type DraftTimelineEntry, type DraftVehicle } from "../../../core";

/** Empty seeds for the two garage composers. */
export const initialVehicleDraft: DraftVehicle = {
  nickname: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  purchaseMonth: "",
  // Empty string is the explicit "Not set" option in the form. The app never
  // pre-selects a fuel, gearbox or ownership on the owner's behalf.
  fuel: "",
  transmission: "",
  ownership: "",
};

export const initialTimelineDraft: DraftTimelineEntry = {
  vehicleId: "",
  kind: "Service",
  title: "",
  amount: 0,
  odometerKm: 0,
  happenedOn: new Date().toISOString().slice(0, 10),
  note: "",
};
