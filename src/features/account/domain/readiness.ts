import { type HostedApiReadinessItem, type LaunchReadinessItem, type PrivacyReadinessItem, type ProductionLaunchItem, type ProductionOpsItem, type QaSessionItem, type ResponsiveQaItem, type TesterRun } from "../../../core/entities";

export type LaunchReadinessSummary = {
  ready: number;
  total: number;
  blocked: LaunchReadinessItem[];
};

export type QaSessionSummary = {
  checked: number;
  total: number;
  remaining: QaSessionItem[];
};

export type ResponsiveQaSummary = {
  checked: number;
  total: number;
  remaining: ResponsiveQaItem[];
};

export type ProductionLaunchSummary = {
  checked: number;
  total: number;
  remaining: ProductionLaunchItem[];
};

export type ProductionOpsSummary = {
  checked: number;
  total: number;
  remaining: ProductionOpsItem[];
};

export type PrivacyReadinessSummary = Record<PrivacyReadinessItem["stance"], number>;

export type TesterRunSummary = {
  total: number;
  useful: number;
  confusing: number;
  blocked: number;
  openFriction: TesterRun[];
};

export type HostedApiReadinessSummary = {
  launchBlockers: number;
  beta: number;
  later: number;
  serviceCenterBoundaries: number;
};

export function buildQaSessionSummary(items: QaSessionItem[], checkedIds: Set<string>): QaSessionSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildResponsiveQaSummary(items: ResponsiveQaItem[], checkedIds: Set<string>): ResponsiveQaSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildProductionLaunchSummary(
  items: ProductionLaunchItem[],
  checkedIds: Set<string>,
): ProductionLaunchSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildProductionOpsSummary(items: ProductionOpsItem[], checkedIds: Set<string>): ProductionOpsSummary {
  return {
    checked: items.filter((item) => checkedIds.has(item.id)).length,
    remaining: items.filter((item) => !checkedIds.has(item.id)),
    total: items.length,
  };
}

export function buildPrivacyReadinessSummary(items: PrivacyReadinessItem[]): PrivacyReadinessSummary {
  return items.reduce<PrivacyReadinessSummary>(
    (summary, item) => ({
      ...summary,
      [item.stance]: summary[item.stance] + 1,
    }),
    {
      "Deletion baseline": 0,
      "Not collected": 0,
      "Stored for MVP": 0,
    },
  );
}

export function buildTesterRunSummary(runs: TesterRun[]): TesterRunSummary {
  return {
    blocked: runs.filter((run) => run.outcome === "Blocked").length,
    confusing: runs.filter((run) => run.outcome === "Confusing").length,
    openFriction: runs.filter((run) => run.outcome !== "Useful").slice(0, 5),
    total: runs.length,
    useful: runs.filter((run) => run.outcome === "Useful").length,
  };
}

export function buildHostedApiReadinessSummary(items: HostedApiReadinessItem[]): HostedApiReadinessSummary {
  return {
    beta: items.filter((item) => item.priority === "Beta").length,
    later: items.filter((item) => item.priority === "Later").length,
    launchBlockers: items.filter((item) => item.priority === "Launch blocker").length,
    serviceCenterBoundaries: items.filter((item) => item.serviceCenterBoundary).length,
  };
}

export function buildLaunchReadinessSummary(items: LaunchReadinessItem[]): LaunchReadinessSummary {
  const blocked = items.filter((item) => !item.ready);

  return {
    blocked,
    ready: items.length - blocked.length,
    total: items.length,
  };
}
