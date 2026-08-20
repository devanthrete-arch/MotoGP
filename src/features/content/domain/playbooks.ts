import { type KnowledgeLabel, type ModelNotebook, type OwnerPost } from "../../../core/entities";
import { groupByModel } from "../../../core/notebooks";
import { type OwnershipPlaybook } from "../../../core/projections";
import { topValues } from "./topValues";

export function buildOwnershipPlaybooks(posts: OwnerPost[]): OwnershipPlaybook[] {
  return groupByModel(posts)
    .map((notebook) => {
      const sortedPosts = [...notebook.posts].sort((first, second) => second.helpful - first.helpful);
      const labels = new Set(notebook.posts.map((post) => post.label));
      const highestOdometer = Math.max(...notebook.posts.map((post) => post.odometerKm));
      const cities = topValues(notebook.posts.map((post) => post.city).filter(Boolean), 2);
      const confidence: OwnershipPlaybook["confidence"] =
        notebook.posts.length >= 4 ? "Strong pattern" : notebook.posts.length >= 2 ? "Useful base" : "Early signal";

      const ownerSignals = [
        labels.has("Fix") ? "Confirmed fixes are available before the owner needs a dealer second opinion." : null,
        labels.has("Cost note") ? "Cost notes are present, so running expenses can be compared with less guesswork." : null,
        labels.has("Travelogue") ? "Road-trip reports add real-world comfort, tyre, fuel, and packing context." : null,
        highestOdometer ? `Community evidence reaches ${highestOdometer.toLocaleString("en-IN")} km.` : null,
      ].filter((signal): signal is string => Boolean(signal));

      const buyerChecks = [
        labels.has("Known issue") ? "Read known issues first and test those symptoms during inspection." : null,
        labels.has("Fix") ? "Ask whether the common fix has already been done and keep the bill handy." : null,
        cities.length ? `Compare notes from ${cities.join(" and ")} before assuming one city’s usage pattern applies everywhere.` : null,
        sortedPosts[0] ? `Start with “${sortedPosts[0].title}” because owners marked it most useful.` : null,
      ].filter((check): check is string => Boolean(check));

      return {
        brand: notebook.brand,
        buyerChecks: buyerChecks.slice(0, 3),
        confidence,
        evidenceCount: notebook.posts.length,
        headline: summarizePlaybook(notebook, labels),
        key: notebook.key,
        model: notebook.model,
        ownerSignals: ownerSignals.slice(0, 3),
      };
    })
    .sort((first, second) => second.evidenceCount - first.evidenceCount || first.key.localeCompare(second.key));
}

function summarizePlaybook(notebook: ModelNotebook, labels: Set<KnowledgeLabel>): string {
  if (labels.has("Known issue") && labels.has("Fix")) {
    return "Known issues and workable fixes are both visible, making this a strong inspection-first notebook.";
  }

  if (labels.has("Review")) {
    return "Owner reviews are available, so buyers can judge daily usability beyond brochure strengths.";
  }

  if (labels.has("Travelogue")) {
    return "Long-drive experience is documented, useful for touring comfort and preparation checks.";
  }

  return `${notebook.brand} ${notebook.model} has early owner evidence ready for deeper community follow-up.`;
}
