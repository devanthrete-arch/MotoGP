import type { ShortlistItem, ShortlistStatus } from "../../core/entities";
import type { InspectionChecklist, InspectionChecklistItem } from "../../insights";
import { asCount, asNullableIsoTimestamp, asOneOf, asText } from "./kernel/coerce";
import { type HostedClient, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { Insert, InspectionItemRow, InspectionSessionRow } from "../supabase/tables";

export const inspectionStatusValues = ["In progress", "Completed", "Abandoned"] as const;
export const inspectionVerdictValues = ["", "Buy", "Negotiate", "Needs recheck", "Walk away"] as const;
export const inspectionItemStateValues = ["Pending", "Pass", "Fail", "Skipped"] as const;
export const inspectionPriorityValues = ["High", "Medium", "Low"] as const;

export type HostedInspectionStatus = (typeof inspectionStatusValues)[number];
export type HostedInspectionVerdict = (typeof inspectionVerdictValues)[number];
export type HostedInspectionItemState = (typeof inspectionItemStateValues)[number];

/** Hosted run of the local `InspectionChecklist`, plus the outcome fields it lacks. */
export type HostedInspectionSession = {
  id: string;
  shortlistItemId: string | null;
  brand: string;
  model: string;
  variant: string;
  city: string;
  odometerKm: number;
  status: HostedInspectionStatus;
  verdict: HostedInspectionVerdict;
  notes: string;
  completedAt: string | null;
  checklist: HostedInspectionItem[];
};

export type HostedInspectionItem = InspectionChecklistItem & {
  checklistItemId: string;
  state: HostedInspectionItemState;
  note: string;
  checkedAt: string | null;
};

export const inspectionSessionIdFor = (shortlistItemId: string): string => `inspection-${shortlistItemId}`;

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const inspectionItemRowToLocal = (row: InspectionItemRow): HostedInspectionItem => ({
  checkedAt: asNullableIsoTimestamp(row.checked_at),
  checklistItemId: asText(row.checklist_item_id),
  detail: asText(row.detail),
  id: asText(row.checklist_item_id) || asText(row.id),
  note: asText(row.note),
  priority: asOneOf<InspectionChecklistItem["priority"]>(row.priority, inspectionPriorityValues, "Medium"),
  state: asOneOf<HostedInspectionItemState>(row.state, inspectionItemStateValues, "Pending"),
  title: asText(row.title),
});

export const inspectionItemToRow = (
  userId: string,
  sessionId: string,
  item: InspectionChecklistItem | HostedInspectionItem,
): Insert<"inspection_items"> => {
  const hosted = item as Partial<HostedInspectionItem>;
  const checklistItemId = asText(hosted.checklistItemId ?? item.id);
  return {
    checked_at: hosted.checkedAt ?? null,
    checklist_item_id: checklistItemId,
    detail: asText(item.detail).slice(0, 2000),
    id: `${sessionId}::${checklistItemId}`,
    note: asText(hosted.note ?? ""),
    priority: asOneOf<InspectionChecklistItem["priority"]>(item.priority, inspectionPriorityValues, "Medium"),
    session_id: sessionId,
    state: asOneOf<HostedInspectionItemState>(hosted.state, inspectionItemStateValues, "Pending"),
    title: asText(item.title, "Inspection check"),
    user_id: userId,
  };
};

export const inspectionSessionRowToLocal = (
  row: InspectionSessionRow,
  itemRows: InspectionItemRow[] = [],
): HostedInspectionSession => ({
  brand: asText(row.brand),
  checklist: itemRows.map(inspectionItemRowToLocal),
  city: asText(row.city),
  completedAt: asNullableIsoTimestamp(row.completed_at),
  id: asText(row.id),
  model: asText(row.model),
  notes: asText(row.notes),
  odometerKm: asCount(row.odometer_km),
  shortlistItemId: row.shortlist_item_id ? asText(row.shortlist_item_id) : null,
  status: asOneOf<HostedInspectionStatus>(row.status, inspectionStatusValues, "In progress"),
  variant: asText(row.variant),
  verdict: asOneOf<HostedInspectionVerdict>(row.verdict, inspectionVerdictValues, ""),
});

/** Local checklist (derived from shortlist + posts) → a hosted session shell. */
export const checklistToSession = (checklist: InspectionChecklist): HostedInspectionSession => ({
  brand: asText(checklist.item.brand),
  checklist: checklist.checklist.map((item) => ({
    ...item,
    checkedAt: null,
    checklistItemId: asText(item.id),
    note: "",
    state: "Pending" as const,
  })),
  city: "",
  completedAt: null,
  id: inspectionSessionIdFor(asText(checklist.item.id)),
  model: asText(checklist.item.model),
  notes: asText(checklist.item.notes),
  odometerKm: 0,
  shortlistItemId: asText(checklist.item.id) || null,
  status: "In progress",
  variant: "",
  verdict: "",
});

export const sessionToRow = (userId: string, session: HostedInspectionSession): Insert<"inspection_sessions"> => ({
  brand: asText(session.brand, "Unknown"),
  city: asText(session.city),
  completed_at: session.completedAt,
  id: asText(session.id),
  model: asText(session.model, "Unknown"),
  notes: asText(session.notes).slice(0, 4000),
  odometer_km: asCount(session.odometerKm),
  shortlist_item_id: session.shortlistItemId ? asText(session.shortlistItemId) : null,
  status: asOneOf<HostedInspectionStatus>(session.status, inspectionStatusValues, "In progress"),
  user_id: userId,
  variant: asText(session.variant),
  verdict: asOneOf<HostedInspectionVerdict>(session.verdict, inspectionVerdictValues, ""),
});

/**
 * Hosted session → the local `InspectionChecklist` the screens already render.
 * The shortlist item is looked up when available and otherwise synthesised from
 * the session so the UI never renders an undefined item.
 */
export const sessionToChecklist = (
  session: HostedInspectionSession,
  shortlistById: Map<string, ShortlistItem> = new Map(),
): InspectionChecklist => {
  const linked = session.shortlistItemId ? shortlistById.get(session.shortlistItemId) : undefined;
  const item: ShortlistItem = linked ?? {
    brand: session.brand,
    budget: 0,
    id: session.shortlistItemId ?? session.id,
    model: session.model,
    notes: session.notes,
    status: "Researching" as ShortlistStatus,
  };
  return {
    checklist: session.checklist.map(({ detail, id, priority, title }) => ({ detail, id, priority, title })),
    item,
  };
};

export const groupInspectionItemRows = (rows: InspectionItemRow[]): Map<string, InspectionItemRow[]> => {
  const grouped = new Map<string, InspectionItemRow[]>();
  rows.forEach((row) => {
    const sessionId = asText(row.session_id);
    const items = grouped.get(sessionId) ?? [];
    items.push(row);
    grouped.set(sessionId, items);
  });
  return grouped;
};

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectInspectionSessionRows = async (
  client: HostedClient,
  userId: string,
): Promise<InspectionSessionRow[]> =>
  unwrap(
    await client
      .from("inspection_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    [],
  );

export const selectInspectionItemRows = async (client: HostedClient, userId: string): Promise<InspectionItemRow[]> =>
  unwrap(await client.from("inspection_items").select("*").eq("user_id", userId), []);

export const listHostedInspections = (
  userId: string | null | undefined,
  fallback: HostedInspectionSession[] = [],
) =>
  runHostedForUser<HostedInspectionSession[]>(userId, fallback, async (client, id) => {
    const [sessionRows, itemRows] = await Promise.all([
      selectInspectionSessionRows(client, id),
      selectInspectionItemRows(client, id),
    ]);
    const itemsBySession = groupInspectionItemRows(itemRows);
    return sessionRows.map((row) => inspectionSessionRowToLocal(row, itemsBySession.get(asText(row.id)) ?? []));
  });

export const upsertHostedInspection = (userId: string | null | undefined, session: HostedInspectionSession) =>
  runHostedForUser<HostedInspectionSession>(userId, session, async (client, id) => {
    unwrapWrite(await client.from("inspection_sessions").upsert(sessionToRow(id, session), { onConflict: "id" }));
    if (session.checklist.length) {
      unwrapWrite(
        await client
          .from("inspection_items")
          .upsert(session.checklist.map((item) => inspectionItemToRow(id, session.id, item)), { onConflict: "id" }),
      );
    }
    return session;
  });

export const upsertHostedInspections = (
  userId: string | null | undefined,
  sessions: HostedInspectionSession[],
) =>
  runHostedForUser<HostedInspectionSession[]>(userId, sessions, async (client, id) => {
    if (!sessions.length) return sessions;
    unwrapWrite(
      await client
        .from("inspection_sessions")
        .upsert(sessions.map((session) => sessionToRow(id, session)), { onConflict: "id" }),
    );
    const items = sessions.flatMap((session) =>
      session.checklist.map((item) => inspectionItemToRow(id, session.id, item)),
    );
    if (items.length) {
      unwrapWrite(await client.from("inspection_items").upsert(items, { onConflict: "id" }));
    }
    return sessions;
  });

/** Publish the locally-derived checklists so a buyer can resume them elsewhere. */
export const publishHostedChecklists = (userId: string | null | undefined, checklists: InspectionChecklist[]) =>
  upsertHostedInspections(userId, checklists.map(checklistToSession));

export const setHostedInspectionItemState = (
  userId: string | null | undefined,
  sessionId: string,
  checklistItemId: string,
  state: HostedInspectionItemState,
  note = "",
) =>
  runHostedForUser<HostedInspectionItemState>(userId, state, async (client, id) => {
    const safeState = asOneOf<HostedInspectionItemState>(state, inspectionItemStateValues, "Pending");
    unwrapWrite(
      await client
        .from("inspection_items")
        .update({
          checked_at: safeState === "Pending" ? null : new Date().toISOString(),
          note: asText(note),
          state: safeState,
        })
        .eq("id", `${sessionId}::${checklistItemId}`)
        .eq("user_id", id),
    );
    return safeState;
  });

export const deleteHostedInspection = (userId: string | null | undefined, sessionId: string) =>
  runHostedForUser<string>(userId, sessionId, async (client, id) => {
    unwrapWrite(await client.from("inspection_sessions").delete().eq("id", sessionId).eq("user_id", id));
    return sessionId;
  });
