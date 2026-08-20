/**
 * Public API of the `garage` feature: owned vehicles, service timeline, running costs, reminders and analytics.
 *
 * Other features and the app composition root may only import from this
 * barrel. Everything under `garage/domain`, `garage/data`, `garage/hooks` and
 * `garage/ui` that is not re-exported here is internal to the feature.
 */

export { buildTimelineAnalytics, buildVehicleProfile } from "./domain/analytics";
export type { TimelineAnalytics, TimelineCategorySpend, TimelineMonthSpend, VehicleProfile } from "./domain/analytics";
export { buildGarageCostLedger } from "./domain/costs";
export type { GarageCostLedger } from "./domain/costs";
export { buildGarageExportMarkdown } from "./domain/exportMarkdown";
export { buildGarageInsights } from "./domain/insights";
export type { GarageInsight } from "./domain/insights";
export { buildGarageReminders } from "./domain/reminders";
