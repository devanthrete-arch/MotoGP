import { useMemo } from "react";
import { type OwnerPost, type ShortlistItem } from "../../../core";
import {
  checklistToSession,
  inspectionSessionIdFor,
  type HostedInspectionSession,
} from "../../../infrastructure/hosted";
import { buildInspectionChecklists } from "../domain/inspection";
import { buildShortlistComparisons, buildShortlistDecisionLanes } from "../domain/shortlist";

/**
 * Shortlist comparison, decision lanes and the pre-purchase inspection
 * checklists, plus the hosted inspection run merged onto each checklist.
 */
export function useBuyingDerived({
  hostedInspections,
  posts,
  shortlist,
}: {
  hostedInspections: HostedInspectionSession[];
  posts: OwnerPost[];
  shortlist: ShortlistItem[];
}) {
  const shortlistComparisons = useMemo(() => buildShortlistComparisons(shortlist, posts), [posts, shortlist]);
  const shortlistDecisionLanes = useMemo(() => buildShortlistDecisionLanes(shortlist, posts), [posts, shortlist]);
  const inspectionChecklists = useMemo(() => buildInspectionChecklists(shortlist, posts), [posts, shortlist]);
  const inspectionChecklistByItemId = useMemo(
    () => new Map(inspectionChecklists.map((checklist) => [checklist.item.id, checklist])),
    [inspectionChecklists],
  );

  /**
   * Hosted inspection run per shortlist item.
   *
   * The checklist itself is still derived locally, so it renders identically
   * offline; the hosted session only carries the outcome fields the local
   * checklist has no room for (per-item state, per-item note, verdict, notes,
   * completed_at). Signed-out this is the local checklist with everything
   * Pending, which is exactly what shipped before.
   */
  const inspectionSessionByItemId = useMemo(() => {
    const hostedById = new Map(hostedInspections.map((session) => [session.id, session]));
    return new Map(
      inspectionChecklists.map((checklist) => {
        const shell = checklistToSession(checklist);
        const hosted = hostedById.get(inspectionSessionIdFor(checklist.item.id));
        if (!hosted) return [checklist.item.id, shell] as const;
        const hostedItemById = new Map(hosted.checklist.map((item) => [item.checklistItemId, item]));
        return [
          checklist.item.id,
          {
            ...shell,
            checklist: shell.checklist.map((item) => {
              const hostedItem = hostedItemById.get(item.checklistItemId);
              return hostedItem
                ? { ...item, checkedAt: hostedItem.checkedAt, note: hostedItem.note, state: hostedItem.state }
                : item;
            }),
            completedAt: hosted.completedAt,
            notes: hosted.notes || shell.notes,
            status: hosted.status,
            verdict: hosted.verdict,
          },
        ] as const;
      }),
    );
  }, [hostedInspections, inspectionChecklists]);

  return {
    inspectionChecklistByItemId,
    inspectionChecklists,
    inspectionSessionByItemId,
    shortlistComparisons,
    shortlistDecisionLanes,
  };
}
