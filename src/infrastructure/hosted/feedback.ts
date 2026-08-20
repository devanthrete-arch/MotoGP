import type { BuildRole, FeedbackNote, FeedbackStatus } from "../../core/entities";
import { feedbackLoopStages, feedbackStatuses } from "../../core/entities";
import { asIsoTimestamp, asOneOf, asText } from "./kernel/coerce";
import { type HostedClient, type HostedResult, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { FeedbackEntryRow, Insert } from "../supabase/tables";

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const feedbackRowToLocal = (row: FeedbackEntryRow): FeedbackNote => ({
  createdAt: asIsoTimestamp(row.created_at),
  id: asText(row.id),
  loopStage: asOneOf<BuildRole>(row.loop_stage, feedbackLoopStages, "Real user"),
  message: asText(row.message),
  status: asOneOf<FeedbackStatus>(row.status, feedbackStatuses, "New"),
});

export const feedbackToRow = (userId: string, note: FeedbackNote, surface = ""): Insert<"feedback_entries"> => ({
  created_at: asIsoTimestamp(note.createdAt),
  id: asText(note.id),
  loop_stage: asOneOf<BuildRole>(note.loopStage, feedbackLoopStages, "Real user"),
  message: asText(note.message, "(empty note)").slice(0, 4000),
  status: asOneOf<FeedbackStatus>(note.status, feedbackStatuses, "New"),
  surface: asText(surface).slice(0, 120),
  user_id: userId,
});

export const sortFeedbackByRecency = (notes: FeedbackNote[]): FeedbackNote[] =>
  [...notes].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectFeedbackRows = async (client: HostedClient, userId: string): Promise<FeedbackEntryRow[]> =>
  unwrap(
    await client.from("feedback_entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    [],
  );

export const listHostedFeedback = (
  userId: string | null | undefined,
  fallback: FeedbackNote[] = [],
): Promise<HostedResult<FeedbackNote[]>> =>
  runHostedForUser<FeedbackNote[]>(userId, fallback, async (client, id) =>
    sortFeedbackByRecency((await selectFeedbackRows(client, id)).map(feedbackRowToLocal)),
  );

export const upsertHostedFeedbackNote = (
  userId: string | null | undefined,
  note: FeedbackNote,
  surface = "",
) =>
  runHostedForUser<FeedbackNote>(userId, note, async (client, id) => {
    unwrapWrite(await client.from("feedback_entries").upsert(feedbackToRow(id, note, surface), { onConflict: "id" }));
    return note;
  });

export const upsertHostedFeedback = (userId: string | null | undefined, notes: FeedbackNote[], surface = "") =>
  runHostedForUser<FeedbackNote[]>(userId, notes, async (client, id) => {
    if (!notes.length) return notes;
    unwrapWrite(
      await client
        .from("feedback_entries")
        .upsert(notes.map((note) => feedbackToRow(id, note, surface)), { onConflict: "id" }),
    );
    return notes;
  });

export const setHostedFeedbackStatus = (
  userId: string | null | undefined,
  feedbackId: string,
  status: FeedbackStatus,
) =>
  runHostedForUser<FeedbackStatus>(userId, status, async (client, id) => {
    const safeStatus = asOneOf<FeedbackStatus>(status, feedbackStatuses, "New");
    unwrapWrite(
      await client.from("feedback_entries").update({ status: safeStatus }).eq("id", feedbackId).eq("user_id", id),
    );
    return safeStatus;
  });

export const setHostedFeedbackLoopStage = (
  userId: string | null | undefined,
  feedbackId: string,
  loopStage: BuildRole,
) =>
  runHostedForUser<BuildRole>(userId, loopStage, async (client, id) => {
    const safeStage = asOneOf<BuildRole>(loopStage, feedbackLoopStages, "Real user");
    unwrapWrite(
      await client.from("feedback_entries").update({ loop_stage: safeStage }).eq("id", feedbackId).eq("user_id", id),
    );
    return safeStage;
  });

export const deleteHostedFeedbackNote = (userId: string | null | undefined, feedbackId: string) =>
  runHostedForUser<string>(userId, feedbackId, async (client, id) => {
    unwrapWrite(await client.from("feedback_entries").delete().eq("id", feedbackId).eq("user_id", id));
    return feedbackId;
  });
