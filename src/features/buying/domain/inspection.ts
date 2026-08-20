import { type OwnerPost, type ShortlistItem } from "../../../core/entities";
import { modelKeyFor } from "../../../core/identity";
import { type InspectionChecklist, type InspectionChecklistItem } from "../../../core/projections";

export function buildInspectionChecklists(shortlist: ShortlistItem[], posts: OwnerPost[]): InspectionChecklist[] {
  return shortlist.map((item) => {
    const relatedPosts = posts.filter((post) => modelKeyFor(post.brand, post.model) === modelKeyFor(item.brand, item.model));
    const knownIssue = relatedPosts.find((post) => post.label === "Known issue");
    const fix = relatedPosts.find((post) => post.label === "Fix");
    const costNote = relatedPosts.find((post) => post.label === "Cost note");
    const review = relatedPosts.find((post) => post.label === "Review");
    const highestOdometer = relatedPosts.reduce((highest, post) => Math.max(highest, post.odometerKm), 0);

    const checklist = [
      knownIssue
        ? {
            detail: `Owner note: “${knownIssue.title}”`,
            id: `${item.id}-known-issue`,
            priority: "High" as const,
            title: `Inspect known ${knownIssue.topic.toLowerCase()} concern`,
          }
        : null,
      fix
        ? {
            detail: `Ask whether this fix was attempted: “${fix.title}”`,
            id: `${item.id}-fix`,
            priority: "High" as const,
            title: "Verify common fix history",
          }
        : null,
      costNote
        ? {
            detail: `Use this cost reference while negotiating: “${costNote.title}”`,
            id: `${item.id}-cost`,
            priority: "Medium" as const,
            title: "Compare bill and quote expectations",
          }
        : null,
      review
        ? {
            detail: `Cross-check daily usability with: “${review.title}”`,
            id: `${item.id}-review`,
            priority: "Medium" as const,
            title: "Validate ownership fit",
          }
        : null,
      highestOdometer
        ? {
            detail: `Community notes reach ${highestOdometer.toLocaleString("en-IN")} km; compare the seller car against that stage.`,
            id: `${item.id}-odometer`,
            priority: "Low" as const,
            title: "Match odometer-stage expectations",
          }
        : null,
      {
        detail: "Carry a short test-drive route, inspect tyres, service records, insurance claims, and cold-start behavior.",
        id: `${item.id}-baseline`,
        priority: relatedPosts.length ? ("Low" as const) : ("High" as const),
        title: relatedPosts.length ? "Run the baseline used-car inspection" : "Start with a baseline inspection checklist",
      },
    ].filter((entry): entry is InspectionChecklistItem => Boolean(entry));

    return {
      checklist: checklist.slice(0, 5),
      item,
    };
  });
}
