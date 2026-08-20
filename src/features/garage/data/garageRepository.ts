/**
 * The garage feature's remote surface: vehicles, timeline entries, the derived
 * cost rows and the reminder scheduling state. Reminders are the only hosted
 * rows allowed to change what the owner sees, and only their status.
 */

export {
  costsFromTimeline,
  listHostedCosts,
  listHostedReminders,
  setHostedReminderStatus,
  syncHostedCostsFromTimeline,
  upsertHostedCosts,
  upsertHostedReminders,
  upsertHostedTimelineEntries,
  upsertHostedTimelineEntry,
  upsertHostedVehicle,
  upsertHostedVehicles,
} from "../../../infrastructure/hosted";

export type {
  HostedGarageCost,
  HostedGarageReminder,
} from "../../../infrastructure/hosted";
