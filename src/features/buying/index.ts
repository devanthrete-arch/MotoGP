/**
 * Public API of the `buying` feature: shortlists, model comparison and pre-purchase inspection checklists.
 *
 * Other features and the app composition root may only import from this
 * barrel. Everything under `buying/domain`, `buying/data`, `buying/hooks` and
 * `buying/ui` that is not re-exported here is internal to the feature.
 */

export { buildInspectionChecklists } from "./domain/inspection";
export { buildShortlistComparisons, buildShortlistDecisionLanes } from "./domain/shortlist";
export type { ShortlistComparison, ShortlistDecisionLane } from "./domain/shortlist";
export { initialShortlistDraft } from "./domain/drafts";
export { useBuyingDerived } from "./hooks/useBuyingDerived";
export { useBuyingActions } from "./hooks/useBuyingActions";
export * from "./data/buyingRepository";
