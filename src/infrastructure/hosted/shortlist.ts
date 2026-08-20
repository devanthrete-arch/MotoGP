import type { ShortlistItem, ShortlistStatus } from "../../core/entities";
import { shortlistStatuses } from "../../core/entities";
import { asAmount, asText, asOneOf } from "./kernel/coerce";
import { type HostedClient, type HostedResult, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { Insert, ShortlistItemRow } from "../supabase/tables";

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const shortlistRowToLocal = (row: ShortlistItemRow): ShortlistItem => ({
  brand: asText(row.brand),
  budget: asAmount(row.budget),
  id: asText(row.id),
  model: asText(row.model),
  notes: asText(row.notes),
  status: asOneOf<ShortlistStatus>(row.status, shortlistStatuses, "Researching"),
});

export const shortlistItemToRow = (userId: string, item: ShortlistItem): Insert<"shortlist_items"> => ({
  brand: asText(item.brand, "Unknown"),
  budget: asAmount(item.budget),
  deleted_at: null,
  id: asText(item.id),
  model: asText(item.model, "Unknown"),
  notes: asText(item.notes),
  status: asOneOf<ShortlistStatus>(item.status, shortlistStatuses, "Researching"),
  user_id: userId,
});

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectShortlistRows = async (client: HostedClient, userId: string): Promise<ShortlistItemRow[]> =>
  unwrap(
    await client
      .from("shortlist_items")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    [],
  );

export const listHostedShortlist = (userId: string | null | undefined, fallback: ShortlistItem[] = []) =>
  runHostedForUser<ShortlistItem[]>(userId, fallback, async (client, id) =>
    (await selectShortlistRows(client, id)).map(shortlistRowToLocal),
  );

export const upsertHostedShortlistItems = (
  userId: string | null | undefined,
  items: ShortlistItem[],
): Promise<HostedResult<ShortlistItem[]>> =>
  runHostedForUser<ShortlistItem[]>(userId, items, async (client, id) => {
    if (!items.length) return items;
    unwrapWrite(
      await client
        .from("shortlist_items")
        .upsert(items.map((item) => shortlistItemToRow(id, item)), { onConflict: "id" }),
    );
    return items;
  });

export const upsertHostedShortlistItem = (userId: string | null | undefined, item: ShortlistItem) =>
  runHostedForUser<ShortlistItem>(userId, item, async (client, id) => {
    unwrapWrite(await client.from("shortlist_items").upsert(shortlistItemToRow(id, item), { onConflict: "id" }));
    return item;
  });

export const deleteHostedShortlistItem = (userId: string | null | undefined, itemId: string) =>
  runHostedForUser<string>(userId, itemId, async (client, id) => {
    unwrapWrite(
      await client
        .from("shortlist_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("user_id", id),
    );
    return itemId;
  });
