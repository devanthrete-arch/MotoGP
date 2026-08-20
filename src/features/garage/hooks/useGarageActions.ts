import { type Dispatch, type FormEvent, type RefObject, type SetStateAction } from "react";
import { type DraftTimelineEntry, type DraftVehicle, type GarageVehicle, type TimelineEntry } from "../../../core";
import { createTimelineEntry, createVehicle } from "../../../infrastructure/storage/localStore";
import { buildGarageExportMarkdown } from "../domain/exportMarkdown";
import { initialTimelineDraft, initialVehicleDraft } from "../domain/drafts";

/** Port for handing plain text to the app's share/copy ladder. */
export type ShareTextPort = (payload: { text: string; title: string }) => void;

/**
 * Adding a vehicle, adding a service or cost record, picking the active
 * vehicle, and exporting the garage as markdown.
 */
export function useGarageActions({
  garage,
  garageHeadingRef,
  persistGarage,
  persistTimeline,
  setActionMessage,
  setGarageForm,
  setTimelineDraft,
  setVehicleDraft,
  setVehicleMenuOpen,
  shareText,
  timeline,
  timelineDraft,
  vehicleDraft,
  vehicleTriggerRef,
}: {
  garage: GarageVehicle[];
  garageHeadingRef: RefObject<HTMLHeadingElement | null>;
  persistGarage: (next: GarageVehicle[]) => void;
  persistTimeline: (next: TimelineEntry[]) => void;
  setActionMessage: Dispatch<SetStateAction<string>>;
  setGarageForm: Dispatch<SetStateAction<"vehicle" | "record" | null>>;
  setTimelineDraft: Dispatch<SetStateAction<DraftTimelineEntry>>;
  setVehicleDraft: Dispatch<SetStateAction<DraftVehicle>>;
  setVehicleMenuOpen: Dispatch<SetStateAction<boolean>>;
  shareText: ShareTextPort;
  timeline: TimelineEntry[];
  timelineDraft: DraftTimelineEntry;
  vehicleDraft: DraftVehicle;
  vehicleTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const exportGarage = () => {
    void shareText({
      title: "Autoflex garage export",
      text: buildGarageExportMarkdown(garage, timeline),
    });
  };

  const addVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const vehicle = createVehicle({
      ...vehicleDraft,
      nickname: vehicleDraft.nickname.trim() || `${vehicleDraft.brand} ${vehicleDraft.model}`,
      variant: vehicleDraft.variant.trim(),
      odometerKm: Number.isFinite(vehicleDraft.odometerKm) ? vehicleDraft.odometerKm : 0,
    });
    persistGarage([vehicle, ...garage]);
    setTimelineDraft((current) => ({ ...current, vehicleId: vehicle.id }));
    setVehicleDraft(initialVehicleDraft);
    setGarageForm(null);
    setActionMessage(`${vehicle.nickname || `${vehicle.brand} ${vehicle.model}`} added. Add its first service or cost record next.`);
    window.requestAnimationFrame(() => {
      document.getElementById("garage")?.scrollIntoView({ block: "start" });
      garageHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const addTimelineNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!timelineDraft.vehicleId) return;
    const entry = createTimelineEntry({
      ...timelineDraft,
      amount: Number.isFinite(timelineDraft.amount) ? timelineDraft.amount : 0,
      odometerKm: Number.isFinite(timelineDraft.odometerKm) ? timelineDraft.odometerKm : 0,
    });
    persistTimeline([entry, ...timeline]);
    setTimelineDraft({
      ...initialTimelineDraft,
      vehicleId: timelineDraft.vehicleId,
      happenedOn: new Date().toISOString().slice(0, 10),
    });
    setGarageForm(null);
    setActionMessage("Service or cost record saved.");
  };

  const selectVehicle = (vehicleId: string) => {
    const vehicle = garage.find((item) => item.id === vehicleId);
    setTimelineDraft((current) => ({ ...current, vehicleId }));
    setVehicleMenuOpen(false);
    if (vehicle) setActionMessage(`${vehicle.nickname || vehicle.model} selected.`);
    window.requestAnimationFrame(() => vehicleTriggerRef.current?.focus());
  };

  return {
    addTimelineNote,
    addVehicle,
    exportGarage,
    selectVehicle,
  };
}
