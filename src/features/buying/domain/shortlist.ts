import { type OwnerPost, type ShortlistItem } from "../../../core/entities";
import { modelKeyFor } from "../../../core/identity";

export type ShortlistComparison = {
  item: ShortlistItem;
  relatedNotes: number;
  knownIssues: number;
  fixes: number;
  ownerReviews: number;
  confidence: "Low" | "Medium" | "High";
};

export type ShortlistDecisionLane = {
  item: ShortlistItem;
  decision: "Gather evidence" | "Inspect risk" | "Book test drive" | "Negotiate" | "Archive";
  nextAction: string;
  priority: "High" | "Medium" | "Low";
  signal: string;
};

export function buildShortlistComparisons(shortlist: ShortlistItem[], posts: OwnerPost[]): ShortlistComparison[] {
  return shortlist.map((item) => {
    const relatedPosts = posts.filter((post) => modelKeyFor(post.brand, post.model) === modelKeyFor(item.brand, item.model));
    const knownIssues = relatedPosts.filter((post) => post.label === "Known issue").length;
    const fixes = relatedPosts.filter((post) => post.label === "Fix").length;
    const ownerReviews = relatedPosts.filter((post) => post.label === "Review").length;
    const confidence = relatedPosts.length >= 3 ? "High" : relatedPosts.length >= 1 ? "Medium" : "Low";

    return {
      item,
      relatedNotes: relatedPosts.length,
      knownIssues,
      fixes,
      ownerReviews,
      confidence,
    };
  });
}

export function buildShortlistDecisionLanes(shortlist: ShortlistItem[], posts: OwnerPost[]): ShortlistDecisionLane[] {
  return buildShortlistComparisons(shortlist, posts)
    .map((comparison) => {
      if (comparison.item.status === "Bought" || comparison.item.status === "Rejected") {
        return {
          decision: "Archive" as const,
          item: comparison.item,
          nextAction:
            comparison.item.status === "Bought"
              ? "Move the buying notes into your garage timeline after delivery."
              : "Keep the reason visible so the same model does not creep back without new evidence.",
          priority: "Low" as const,
          signal: `${comparison.item.status} decision already logged.`,
        };
      }

      if (!comparison.relatedNotes) {
        return {
          decision: "Gather evidence" as const,
          item: comparison.item,
          nextAction: "Search owner notes, ask the community, or add a baseline inspection before visiting a seller.",
          priority: "High" as const,
          signal: "No matching ownership notes yet.",
        };
      }

      if (comparison.knownIssues > comparison.fixes) {
        return {
          decision: "Inspect risk" as const,
          item: comparison.item,
          nextAction: "Check the known issue during the test drive and ask for service proof before negotiating.",
          priority: "High" as const,
          signal: `${comparison.knownIssues} issue signal${comparison.knownIssues === 1 ? "" : "s"} and ${comparison.fixes} fix signal${
            comparison.fixes === 1 ? "" : "s"
          }.`,
        };
      }

      if (comparison.item.status === "Negotiating") {
        return {
          decision: "Negotiate" as const,
          item: comparison.item,
          nextAction: "Use owner costs, fixes, and inspection findings to set a walk-away number.",
          priority: "Medium" as const,
          signal: `${comparison.relatedNotes} evidence note${comparison.relatedNotes === 1 ? "" : "s"} ready for price discussion.`,
        };
      }

      return {
        decision: "Book test drive" as const,
        item: comparison.item,
        nextAction: "Take the inspection checklist, compare odometer-stage notes, and log what the seller cannot prove.",
        priority: comparison.confidence === "High" ? ("Medium" as const) : ("Low" as const),
        signal: `${comparison.confidence} confidence from ${comparison.relatedNotes} related note${
          comparison.relatedNotes === 1 ? "" : "s"
        }.`,
      };
    })
    .sort((first, second) => {
      const priorityRank: Record<ShortlistDecisionLane["priority"], number> = { High: 0, Medium: 1, Low: 2 };
      return priorityRank[first.priority] - priorityRank[second.priority] || first.item.model.localeCompare(second.item.model);
    });
}
