/**
 * Public API of the `core` layer: the shared domain vocabulary every other
 * layer is allowed to speak. Nothing in here imports React, Supabase, or a
 * browser API, and nothing in here may import `features/`, `infrastructure/`,
 * `ui/` or `app/`.
 *
 * The vehicle catalog is deliberately NOT re-exported here — it is a large
 * frozen data table and is imported directly from `core/catalog` by the two
 * screens that need it, so it never rides along with a type-only import.
 */

export { buildLoop, feedbackLoopStages, feedbackStatuses, hostedApiReadinessItems, knowledgeLabels, launchReadinessItems, privacyReadinessItems, productionLaunchItems, productionOpsItems, qaSessionItems, responsiveQaItems, seedGarage, seedPosts, seedTimeline, shortlistStatuses, starterRoutes, testerRunOutcomes, timelineKinds, vehicleFuels, vehicleOwnerships, vehicleTransmissions } from "./entities";
export type { BuildLoopItem, BuildRole, DraftPost, DraftReport, DraftShortlistItem, DraftTesterRun, DraftTimelineEntry, DraftVehicle, FeedbackNote, FeedbackStatus, FollowState, GarageVehicle, HostedApiReadinessItem, KnowledgeLabel, LaunchReadinessItem, ModelNotebook, OwnerPost, PrivacyReadinessItem, ProductionLaunchItem, ProductionOpsItem, Profile, QaSessionItem, ReportRecord, ReportStatus, ResponsiveBreakpoint, ResponsiveQaItem, ShortlistItem, ShortlistStatus, StarterRoute, SubscriptionSettings, TesterRun, TesterRunOutcome, TimelineEntry, TimelineEntryKind, VehicleFuel, VehicleOwnership, VehicleTransmission } from "./entities";
export { modelKeyFor, slugifyCity } from "./identity";
export { groupByModel } from "./notebooks";
export { formatMoney } from "./money";
export { assessPostQuality } from "./postQuality";
export type { PostQualityInput, PostQualityReport } from "./postQuality";
export type { CityCircle, GarageReminder, InspectionChecklist, InspectionChecklistItem, OwnershipPlaybook } from "./projections";
