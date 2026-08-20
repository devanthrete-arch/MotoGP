import type { GarageVehicle, TimelineEntry, TimelineEntryKind } from "../../core/entities";
import { timelineKinds, vehicleFuels, vehicleOwnerships, vehicleTransmissions } from "../../core/entities";
import { type GarageReminder } from "../../core/projections";
import { asAmount, asCount, asDateOnly, asNullableDateOnly, asOneOf, asText } from "./kernel/coerce";
import { type HostedClient, type HostedResult, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { GarageCostRow, GarageReminderRow, GarageVehicleRow, Insert, TimelineEntryRow } from "../supabase/tables";

export const reminderUrgencyValues = ["Soon", "Plan", "Watch"] as const;
export const reminderKindValues = ["Service", "Insurance", "Tyres", "PUC", "Fitness", "Custom"] as const;
export const reminderStatusValues = ["Open", "Snoozed", "Done", "Dismissed"] as const;
export const costCategoryValues = [
  "Service",
  "Repair",
  "Tyres",
  "Insurance",
  "Fuel",
  "Trip",
  "Accessories",
  "Tax",
  "Other",
] as const;

export type HostedCostCategory = (typeof costCategoryValues)[number];
export type HostedReminderKind = (typeof reminderKindValues)[number];
export type HostedReminderStatus = (typeof reminderStatusValues)[number];

/** Ledger row shape the app can hold locally; `buildGarageCostLedger()` still derives totals. */
export type HostedGarageCost = {
  id: string;
  vehicleId: string;
  timelineEntryId: string | null;
  category: HostedCostCategory;
  title: string;
  amount: number;
  odometerKm: number;
  incurredOn: string;
  note: string;
};

/** Hosted scheduling fields that the derived local `GarageReminder` does not carry. */
export type HostedGarageReminder = GarageReminder & {
  kind: HostedReminderKind;
  status: HostedReminderStatus;
  dueDate: string | null;
  dueOdometerKm: number | null;
};

/* -------------------------------------------------------------------------- */
/* Pure mappers — vehicles                                                     */
/* -------------------------------------------------------------------------- */

export const vehicleRowToLocal = (row: GarageVehicleRow): GarageVehicle => ({
  brand: asText(row.brand),
  city: asText(row.city),
  // Null in Postgres and "" locally both mean "not recorded"; normalising here
  // keeps the two representations from drifting apart.
  fuel: asOneOf(row.fuel, vehicleFuels, ""),
  id: asText(row.id),
  model: asText(row.model),
  nickname: asText(row.nickname),
  odometerKm: asCount(row.odometer_km),
  ownership: asOneOf(row.ownership, vehicleOwnerships, ""),
  purchaseMonth: /^\d{4}-\d{2}$/.test(asText(row.purchase_month)) ? asText(row.purchase_month) : "",
  transmission: asOneOf(row.transmission, vehicleTransmissions, ""),
  variant: asText(row.variant),
});

export const vehicleToRow = (userId: string, vehicle: GarageVehicle): Insert<"garage_vehicles"> => ({
  brand: asText(vehicle.brand, "Unknown"),
  city: asText(vehicle.city),
  deleted_at: null,
  fuel: vehicle.fuel || null,
  id: asText(vehicle.id),
  ownership: vehicle.ownership || null,
  transmission: vehicle.transmission || null,
  model: asText(vehicle.model, "Unknown"),
  nickname: asText(vehicle.nickname),
  odometer_km: asCount(vehicle.odometerKm),
  purchase_month: /^\d{4}-\d{2}$/.test(asText(vehicle.purchaseMonth)) ? asText(vehicle.purchaseMonth) : "",
  user_id: userId,
  variant: asText(vehicle.variant),
});

export const vehicleDisplayName = (vehicle: GarageVehicle): string =>
  vehicle.nickname || `${vehicle.brand} ${vehicle.model}`.trim() || vehicle.id;

/* -------------------------------------------------------------------------- */
/* Pure mappers — timeline                                                     */
/* -------------------------------------------------------------------------- */

export const timelineRowToLocal = (row: TimelineEntryRow): TimelineEntry => ({
  amount: asAmount(row.amount),
  happenedOn: asDateOnly(row.happened_on),
  id: asText(row.id),
  kind: asOneOf<TimelineEntryKind>(row.kind, timelineKinds, "Note"),
  note: asText(row.note),
  odometerKm: asCount(row.odometer_km),
  title: asText(row.title),
  vehicleId: asText(row.vehicle_id),
});

export const timelineEntryToRow = (userId: string, entry: TimelineEntry): Insert<"timeline_entries"> => ({
  amount: asAmount(entry.amount),
  deleted_at: null,
  happened_on: asDateOnly(entry.happenedOn),
  id: asText(entry.id),
  kind: asOneOf<TimelineEntryKind>(entry.kind, timelineKinds, "Note"),
  note: asText(entry.note),
  odometer_km: asCount(entry.odometerKm),
  title: asText(entry.title, "Ownership note"),
  user_id: userId,
  vehicle_id: asText(entry.vehicleId),
});

/* -------------------------------------------------------------------------- */
/* Pure mappers — costs                                                        */
/* -------------------------------------------------------------------------- */

export const costCategoryForTimelineKind = (kind: TimelineEntryKind): HostedCostCategory =>
  kind === "Note" ? "Other" : asOneOf<HostedCostCategory>(kind, costCategoryValues, "Other");

export const costRowToLocal = (row: GarageCostRow): HostedGarageCost => ({
  amount: asAmount(row.amount_inr),
  category: asOneOf<HostedCostCategory>(row.category, costCategoryValues, "Other"),
  id: asText(row.id),
  incurredOn: asDateOnly(row.incurred_on),
  note: asText(row.note),
  odometerKm: asCount(row.odometer_km),
  timelineEntryId: row.timeline_entry_id ? asText(row.timeline_entry_id) : null,
  title: asText(row.title),
  vehicleId: asText(row.vehicle_id),
});

export const costToRow = (userId: string, cost: HostedGarageCost): Insert<"garage_costs"> => ({
  amount_inr: asAmount(cost.amount),
  category: asOneOf<HostedCostCategory>(cost.category, costCategoryValues, "Other"),
  id: asText(cost.id),
  incurred_on: asDateOnly(cost.incurredOn),
  note: asText(cost.note),
  odometer_km: asCount(cost.odometerKm),
  timeline_entry_id: cost.timelineEntryId ? asText(cost.timelineEntryId) : null,
  title: asText(cost.title).slice(0, 180),
  user_id: userId,
  vehicle_id: asText(cost.vehicleId),
});

/** Every priced timeline note becomes a ledger row, keyed deterministically off the note id. */
export const timelineEntryToCost = (entry: TimelineEntry): HostedGarageCost => ({
  amount: asAmount(entry.amount),
  category: costCategoryForTimelineKind(entry.kind),
  id: `cost-${asText(entry.id)}`,
  incurredOn: asDateOnly(entry.happenedOn),
  note: asText(entry.note),
  odometerKm: asCount(entry.odometerKm),
  timelineEntryId: asText(entry.id),
  title: asText(entry.title),
  vehicleId: asText(entry.vehicleId),
});

export const costsFromTimeline = (entries: TimelineEntry[]): HostedGarageCost[] =>
  entries.filter((entry) => asAmount(entry.amount) > 0).map(timelineEntryToCost);

/* -------------------------------------------------------------------------- */
/* Pure mappers — reminders                                                    */
/* -------------------------------------------------------------------------- */

export const reminderKindForLocalId = (reminderId: string): HostedReminderKind => {
  const id = reminderId.toLowerCase();
  if (id.includes("insurance")) return "Insurance";
  if (id.includes("tyre")) return "Tyres";
  if (id.includes("service")) return "Service";
  if (id.includes("puc")) return "PUC";
  if (id.includes("fitness")) return "Fitness";
  return "Custom";
};

export const reminderRowToLocal = (
  row: GarageReminderRow,
  vehicleNameById: Map<string, string> = new Map(),
): HostedGarageReminder => {
  const vehicleId = asText(row.vehicle_id);
  return {
    detail: asText(row.detail),
    dueDate: asNullableDateOnly(row.due_date),
    dueOdometerKm: row.due_odometer_km === null || row.due_odometer_km === undefined ? null : asCount(row.due_odometer_km),
    id: asText(row.id),
    kind: asOneOf<HostedReminderKind>(row.kind, reminderKindValues, "Custom"),
    status: asOneOf<HostedReminderStatus>(row.status, reminderStatusValues, "Open"),
    title: asText(row.title),
    urgency: asOneOf<GarageReminder["urgency"]>(row.urgency, reminderUrgencyValues, "Plan"),
    vehicleId,
    vehicleName: vehicleNameById.get(vehicleId) ?? vehicleId,
  };
};

export const reminderToRow = (
  userId: string,
  reminder: GarageReminder | HostedGarageReminder,
): Insert<"garage_reminders"> => {
  const hosted = reminder as Partial<HostedGarageReminder>;
  return {
    detail: asText(reminder.detail),
    due_date: asNullableDateOnly(hosted.dueDate ?? null),
    due_odometer_km: hosted.dueOdometerKm === null || hosted.dueOdometerKm === undefined ? null : asCount(hosted.dueOdometerKm),
    id: asText(reminder.id),
    kind: asOneOf<HostedReminderKind>(hosted.kind, reminderKindValues, reminderKindForLocalId(asText(reminder.id))),
    status: asOneOf<HostedReminderStatus>(hosted.status, reminderStatusValues, "Open"),
    title: asText(reminder.title, "Garage reminder"),
    urgency: asOneOf<GarageReminder["urgency"]>(reminder.urgency, reminderUrgencyValues, "Plan"),
    user_id: userId,
    vehicle_id: asText(reminder.vehicleId),
  };
};

export const vehicleNameIndex = (vehicles: GarageVehicle[]): Map<string, string> =>
  new Map(vehicles.map((vehicle) => [vehicle.id, vehicleDisplayName(vehicle)]));

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectVehicleRows = async (client: HostedClient, userId: string): Promise<GarageVehicleRow[]> =>
  unwrap(await client.from("garage_vehicles").select("*").eq("user_id", userId).is("deleted_at", null), []);

export const selectTimelineRows = async (client: HostedClient, userId: string): Promise<TimelineEntryRow[]> =>
  unwrap(
    await client
      .from("timeline_entries")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("happened_on", { ascending: false }),
    [],
  );

export const selectCostRows = async (client: HostedClient, userId: string): Promise<GarageCostRow[]> =>
  unwrap(
    await client.from("garage_costs").select("*").eq("user_id", userId).order("incurred_on", { ascending: false }),
    [],
  );

export const selectReminderRows = async (client: HostedClient, userId: string): Promise<GarageReminderRow[]> =>
  unwrap(await client.from("garage_reminders").select("*").eq("user_id", userId), []);

export const listHostedGarage = (userId: string | null | undefined, fallback: GarageVehicle[] = []) =>
  runHostedForUser<GarageVehicle[]>(userId, fallback, async (client, id) =>
    (await selectVehicleRows(client, id)).map(vehicleRowToLocal),
  );

export const upsertHostedVehicles = (
  userId: string | null | undefined,
  vehicles: GarageVehicle[],
): Promise<HostedResult<GarageVehicle[]>> =>
  runHostedForUser<GarageVehicle[]>(userId, vehicles, async (client, id) => {
    if (!vehicles.length) return vehicles;
    unwrapWrite(
      await client
        .from("garage_vehicles")
        .upsert(vehicles.map((vehicle) => vehicleToRow(id, vehicle)), { onConflict: "id" }),
    );
    return vehicles;
  });

export const upsertHostedVehicle = (userId: string | null | undefined, vehicle: GarageVehicle) =>
  runHostedForUser<GarageVehicle>(userId, vehicle, async (client, id) => {
    unwrapWrite(await client.from("garage_vehicles").upsert(vehicleToRow(id, vehicle), { onConflict: "id" }));
    return vehicle;
  });

/** Soft delete so the workspace sync RPC and other devices see the tombstone. */
export const deleteHostedVehicle = (userId: string | null | undefined, vehicleId: string) =>
  runHostedForUser<string>(userId, vehicleId, async (client, id) => {
    unwrapWrite(
      await client
        .from("garage_vehicles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", vehicleId)
        .eq("user_id", id),
    );
    return vehicleId;
  });

export const listHostedTimeline = (userId: string | null | undefined, fallback: TimelineEntry[] = []) =>
  runHostedForUser<TimelineEntry[]>(userId, fallback, async (client, id) =>
    (await selectTimelineRows(client, id)).map(timelineRowToLocal),
  );

export const upsertHostedTimelineEntries = (userId: string | null | undefined, entries: TimelineEntry[]) =>
  runHostedForUser<TimelineEntry[]>(userId, entries, async (client, id) => {
    if (!entries.length) return entries;
    unwrapWrite(
      await client
        .from("timeline_entries")
        .upsert(entries.map((entry) => timelineEntryToRow(id, entry)), { onConflict: "id" }),
    );
    return entries;
  });

export const upsertHostedTimelineEntry = (userId: string | null | undefined, entry: TimelineEntry) =>
  runHostedForUser<TimelineEntry>(userId, entry, async (client, id) => {
    unwrapWrite(await client.from("timeline_entries").upsert(timelineEntryToRow(id, entry), { onConflict: "id" }));
    return entry;
  });

export const deleteHostedTimelineEntry = (userId: string | null | undefined, entryId: string) =>
  runHostedForUser<string>(userId, entryId, async (client, id) => {
    unwrapWrite(
      await client
        .from("timeline_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", entryId)
        .eq("user_id", id),
    );
    return entryId;
  });

export const listHostedCosts = (userId: string | null | undefined, fallback: HostedGarageCost[] = []) =>
  runHostedForUser<HostedGarageCost[]>(userId, fallback, async (client, id) =>
    (await selectCostRows(client, id)).map(costRowToLocal),
  );

export const upsertHostedCosts = (userId: string | null | undefined, costs: HostedGarageCost[]) =>
  runHostedForUser<HostedGarageCost[]>(userId, costs, async (client, id) => {
    if (!costs.length) return costs;
    unwrapWrite(
      await client.from("garage_costs").upsert(costs.map((cost) => costToRow(id, cost)), { onConflict: "id" }),
    );
    return costs;
  });

/** Convenience bulk helper: mirror the priced part of the local timeline into the ledger. */
export const syncHostedCostsFromTimeline = (userId: string | null | undefined, entries: TimelineEntry[]) =>
  upsertHostedCosts(userId, costsFromTimeline(entries));

export const deleteHostedCost = (userId: string | null | undefined, costId: string) =>
  runHostedForUser<string>(userId, costId, async (client, id) => {
    unwrapWrite(await client.from("garage_costs").delete().eq("id", costId).eq("user_id", id));
    return costId;
  });

export const listHostedReminders = (
  userId: string | null | undefined,
  vehicles: GarageVehicle[] = [],
  fallback: HostedGarageReminder[] = [],
) =>
  runHostedForUser<HostedGarageReminder[]>(userId, fallback, async (client, id) => {
    const names = vehicleNameIndex(vehicles);
    return (await selectReminderRows(client, id)).map((row) => reminderRowToLocal(row, names));
  });

export const upsertHostedReminders = (
  userId: string | null | undefined,
  reminders: (GarageReminder | HostedGarageReminder)[],
) =>
  runHostedForUser(userId, reminders, async (client, id) => {
    if (!reminders.length) return reminders;
    unwrapWrite(
      await client
        .from("garage_reminders")
        .upsert(reminders.map((reminder) => reminderToRow(id, reminder)), { onConflict: "id" }),
    );
    return reminders;
  });

export const setHostedReminderStatus = (
  userId: string | null | undefined,
  reminderId: string,
  status: HostedReminderStatus,
) =>
  runHostedForUser<HostedReminderStatus>(userId, status, async (client, id) => {
    const safeStatus = asOneOf<HostedReminderStatus>(status, reminderStatusValues, "Open");
    unwrapWrite(
      await client
        .from("garage_reminders")
        .update({
          completed_at: safeStatus === "Done" ? new Date().toISOString() : null,
          status: safeStatus,
        })
        .eq("id", reminderId)
        .eq("user_id", id),
    );
    return safeStatus;
  });

export const deleteHostedReminder = (userId: string | null | undefined, reminderId: string) =>
  runHostedForUser<string>(userId, reminderId, async (client, id) => {
    unwrapWrite(await client.from("garage_reminders").delete().eq("id", reminderId).eq("user_id", id));
    return reminderId;
  });
