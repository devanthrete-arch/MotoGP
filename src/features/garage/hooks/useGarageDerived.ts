import { useMemo } from "react";
import { type GarageVehicle, type TimelineEntry } from "../../../core";
import { type HostedGarageCost, type HostedGarageReminder } from "../data/garageRepository";
import { buildGarageCostLedger } from "../domain/costs";
import { buildGarageReminders } from "../domain/reminders";
import { buildTimelineAnalytics } from "../domain/analytics";

/**
 * Running costs, reminders and timeline analytics for the owned vehicles.
 *
 * Reminders are the one place hosted data is allowed to change what the owner
 * sees, and only for scheduling state — the local derivation still decides
 * *what* is due, so the garage renders identically with no network.
 */
export function useGarageDerived({
  garage,
  hostedCosts,
  hostedReminders,
  timeline,
}: {
  garage: GarageVehicle[];
  hostedCosts: HostedGarageCost[];
  hostedReminders: HostedGarageReminder[];
  timeline: TimelineEntry[];
}) {
  const garageCostLedger = useMemo(() => buildGarageCostLedger(garage, timeline), [garage, timeline]);
  const localReminders = useMemo(() => buildGarageReminders(garage, timeline), [garage, timeline]);
  const timelineAnalytics = useMemo(() => buildTimelineAnalytics(garage, timeline), [garage, timeline]);
  const vehicleProfileById = useMemo(
    () => new Map(timelineAnalytics.map((analytics) => [analytics.vehicle.id, analytics.profile])),
    [timelineAnalytics],
  );

  /**
   * Derived reminders stay the source of truth for *what* is due; the hosted row
   * only contributes scheduling state (Open / Snoozed / Done / Dismissed).
   * Reminders the user closed hosted disappear; hosted-only reminders are added.
   */
  const garageReminders = useMemo(() => {
    if (!hostedReminders.length) return localReminders;
    const hostedById = new Map(hostedReminders.map((reminder) => [reminder.id, reminder]));
    const localIds = new Set(localReminders.map((reminder) => reminder.id));
    const merged = localReminders
      .map((reminder) => {
        const hosted = hostedById.get(reminder.id);
        if (!hosted) return reminder;
        return hosted.status === "Done" || hosted.status === "Dismissed" ? null : { ...reminder, ...hosted, vehicleName: reminder.vehicleName };
      })
      .filter((reminder): reminder is NonNullable<typeof reminder> => Boolean(reminder));
    const hostedOnly = hostedReminders.filter(
      (reminder) => !localIds.has(reminder.id) && reminder.status !== "Done" && reminder.status !== "Dismissed",
    );
    return [...merged, ...hostedOnly];
  }, [hostedReminders, localReminders]);

  const reminderStatusById = useMemo(
    () => new Map(hostedReminders.map((reminder) => [reminder.id, reminder.status])),
    [hostedReminders],
  );

  const hostedCostByVehicleId = useMemo(() => {
    const totals = new Map<string, { entryCount: number; totalSpend: number }>();
    hostedCosts.forEach((cost) => {
      const current = totals.get(cost.vehicleId) ?? { entryCount: 0, totalSpend: 0 };
      totals.set(cost.vehicleId, { entryCount: current.entryCount + 1, totalSpend: current.totalSpend + cost.amount });
    });
    return totals;
  }, [hostedCosts]);

  return {
    garageCostLedger,
    garageReminders,
    hostedCostByVehicleId,
    localReminders,
    reminderStatusById,
    timelineAnalytics,
    vehicleProfileById,
  };
}
