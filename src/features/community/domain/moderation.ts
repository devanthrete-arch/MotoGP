import { type ReportRecord } from "../../../core/entities";

export type ModerationSummary = {
  openReports: number;
  dismissedReports: number;
  removedReports: number;
  riskyPostIds: string[];
};

export function buildModerationSummary(reports: ReportRecord[]): ModerationSummary {
  const openReports = reports.filter((report) => report.status === "Open");
  const reportCounts = openReports.reduce<Map<string, number>>((counts, report) => {
    counts.set(report.postId, (counts.get(report.postId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return {
    openReports: openReports.length,
    dismissedReports: reports.filter((report) => report.status === "Dismissed").length,
    removedReports: reports.filter((report) => report.status === "Removed").length,
    riskyPostIds: [...reportCounts.entries()].filter(([, count]) => count >= 2).map(([postId]) => postId),
  };
}
