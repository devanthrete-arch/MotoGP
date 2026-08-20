/**
 * Public API of the `account` feature: profile, backup/restore, connection status and launch/QA readiness.
 *
 * Other features and the app composition root may only import from this
 * barrel. Everything under `account/domain`, `account/data`, `account/hooks` and
 * `account/ui` that is not re-exported here is internal to the feature.
 */

export { buildConnectionStatusCopy } from "./domain/connection";
export type { ConnectionStatusCopy } from "./domain/connection";
export { buildFeedbackLoopSummary, buildFeedbackTriageSummary } from "./domain/feedback";
export type { FeedbackLoopSummary, FeedbackTriageSummary } from "./domain/feedback";
export { buildReturnNudges, buildStarterRouteProgress } from "./domain/onboarding";
export type { StarterRouteProgress } from "./domain/onboarding";
export { buildQaHandoffMarkdown } from "./domain/qaHandoff";
export type { QaHandoffInput } from "./domain/qaHandoff";
export { buildHostedApiReadinessSummary, buildLaunchReadinessSummary, buildPrivacyReadinessSummary, buildProductionLaunchSummary, buildProductionOpsSummary, buildQaSessionSummary, buildResponsiveQaSummary, buildTesterRunSummary } from "./domain/readiness";
export type { HostedApiReadinessSummary, LaunchReadinessSummary, PrivacyReadinessSummary, ProductionLaunchSummary, ProductionOpsSummary, QaSessionSummary, ResponsiveQaSummary, TesterRunSummary } from "./domain/readiness";
export { useConnectionStatus } from "./hooks/useConnectionStatus";
