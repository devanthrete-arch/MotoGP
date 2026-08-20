import { type Profile } from "../../../core/entities";
import { type FeedbackLoopSummary, type FeedbackTriageSummary } from "./feedback";
import { type HostedApiReadinessSummary, type LaunchReadinessSummary, type PrivacyReadinessSummary, type ProductionLaunchSummary, type ProductionOpsSummary, type QaSessionSummary, type ResponsiveQaSummary, type TesterRunSummary } from "./readiness";

export type QaHandoffInput = {
  feedbackLoopSummary: FeedbackLoopSummary;
  feedbackSummary: FeedbackTriageSummary;
  generatedAt: string;
  hostedApiSummary: HostedApiReadinessSummary;
  launchSummary: LaunchReadinessSummary;
  profile: Profile;
  privacySummary: PrivacyReadinessSummary;
  productionLaunchSummary: ProductionLaunchSummary;
  productionOpsSummary: ProductionOpsSummary;
  productionUrl: string;
  qaSummary: QaSessionSummary;
  responsiveQaSummary: ResponsiveQaSummary;
  testerRunSummary: TesterRunSummary;
};

export function buildQaHandoffMarkdown(input: QaHandoffInput): string {
  const feedbackTotal = Object.values(input.feedbackSummary).reduce((total, count) => total + count, 0);
  const remainingQa = input.qaSummary.remaining.map((item) => `- ${item.label}`).join("\n") || "- None";
  const remainingResponsiveQa =
    input.responsiveQaSummary.remaining.map((item) => `- ${item.breakpoint} / ${item.surface}: ${item.label}`).join("\n") ||
    "- None";
  const launchBlockers = input.launchSummary.blocked.map((item) => `- ${item.label}: ${item.detail}`).join("\n") || "- None";
  const productionLaunchRemaining =
    input.productionLaunchSummary.remaining.map((item) => `- ${item.label}: ${item.detail}`).join("\n") || "- None";
  const productionOpsRemaining =
    input.productionOpsSummary.remaining.map((item) => `- ${item.label}: ${item.detail}`).join("\n") || "- None";
  const testerFriction =
    input.testerRunSummary.openFriction
      .map((run) => `- ${run.outcome} / ${run.nextLoopStage}: ${run.scenario} — ${run.friction}`)
      .join("\n") || "- None";
  const loopRouting = Object.entries(input.feedbackLoopSummary)
    .map(([stage, count]) => `- ${stage}: ${count}`)
    .join("\n");

  return [
    "# Autoflex QA handoff",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Tester identity",
    "",
    `Name: ${input.profile.displayName.trim() || "Anonymous garage member"}`,
    `City: ${input.profile.city.trim() || "Not set"}`,
    `Role: ${input.profile.garageRole}`,
    "",
    "## QA session",
    "",
    `Checked: ${input.qaSummary.checked}/${input.qaSummary.total}`,
    "",
    "Remaining smoke checks:",
    remainingQa,
    "",
    "## Responsive QA",
    "",
    `Checked: ${input.responsiveQaSummary.checked}/${input.responsiveQaSummary.total}`,
    "",
    "Remaining responsive checks:",
    remainingResponsiveQa,
    "",
    "## Launch readiness",
    "",
    `Ready: ${input.launchSummary.ready}/${input.launchSummary.total}`,
    `Production URL: ${input.productionUrl.trim() || "Not set"}`,
    "",
    "Open blockers:",
    launchBlockers,
    "",
    "Production launch checks:",
    `Checked: ${input.productionLaunchSummary.checked}/${input.productionLaunchSummary.total}`,
    "",
    "Remaining production checks:",
    productionLaunchRemaining,
    "",
    "Production operations:",
    `Checked: ${input.productionOpsSummary.checked}/${input.productionOpsSummary.total}`,
    "",
    "Remaining operations checks:",
    productionOpsRemaining,
    "",
    "## Feedback triage",
    "",
    `Total tester notes: ${feedbackTotal}`,
    `New: ${input.feedbackSummary.New}`,
    `Reviewing: ${input.feedbackSummary.Reviewing}`,
    `Planned: ${input.feedbackSummary.Planned}`,
    `Shipped: ${input.feedbackSummary.Shipped}`,
    "",
    "Loop routing:",
    loopRouting,
    "",
    "## Real-user test runs",
    "",
    `Runs: ${input.testerRunSummary.total}`,
    `Useful: ${input.testerRunSummary.useful}`,
    `Confusing: ${input.testerRunSummary.confusing}`,
    `Blocked: ${input.testerRunSummary.blocked}`,
    "",
    "Open tester friction:",
    testerFriction,
    "",
    "## Hosted API readiness",
    "",
    `Launch blockers: ${input.hostedApiSummary.launchBlockers}`,
    `Beta items: ${input.hostedApiSummary.beta}`,
    `Later items: ${input.hostedApiSummary.later}`,
    `Service-center boundaries: ${input.hostedApiSummary.serviceCenterBoundaries}`,
    "",
    "## Privacy readiness",
    "",
    `Stored for MVP: ${input.privacySummary["Stored for MVP"]}`,
    `Not collected: ${input.privacySummary["Not collected"]}`,
    `Deletion baseline: ${input.privacySummary["Deletion baseline"]}`,
    "",
    "## Service-center boundary",
    "",
    "Service-center integration remains outside this MVP loop until the owning team provides its contract.",
  ].join("\n");
}
