/**
 * Public API of the `content` feature: city circles, ownership playbooks and the evidence scoring behind them.
 *
 * Other features and the app composition root may only import from this
 * barrel. Everything under `content/domain`, `content/data`, `content/hooks` and
 * `content/ui` that is not re-exported here is internal to the feature.
 */

export { buildCityCircles } from "./domain/cityCircles";
export { scoreCityEvidence, scorePlaybookEvidence } from "./domain/evidence";
export type { EvidenceScore } from "./domain/evidence";
export { buildOwnershipPlaybooks } from "./domain/playbooks";
export { topValues } from "./domain/topValues";
export { useContentDerived } from "./hooks/useContentDerived";
export * from "./data/contentRepository";
