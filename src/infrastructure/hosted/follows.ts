import type { FollowState } from "../../core/entities";
import { asStringList, asText, slugify } from "./kernel/coerce";
import { type HostedClient, type HostedResult, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { CityFollowRow, FollowRow, Insert } from "../supabase/tables";

export const emptyFollowState: FollowState = { models: [], topics: [] };

export type HostedCityFollow = {
  citySlug: string;
  notify: boolean;
};

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const followRowToLocal = (row: Pick<FollowRow, "models" | "topics"> | null): FollowState =>
  row ? { models: asStringList(row.models), topics: asStringList(row.topics) } : { ...emptyFollowState };

export const followStateToRow = (userId: string, follows: FollowState): Insert<"follows"> => ({
  models: asStringList(follows.models),
  topics: asStringList(follows.topics),
  user_id: userId,
});

export const cityFollowRowToLocal = (row: Pick<CityFollowRow, "city_slug" | "notify">): HostedCityFollow => ({
  citySlug: asText(row.city_slug),
  notify: row.notify !== false,
});

export const cityFollowToRow = (userId: string, follow: HostedCityFollow): Insert<"city_follows"> => ({
  city_slug: slugify(asText(follow.citySlug)),
  notify: follow.notify !== false,
  user_id: userId,
});

export const mergeFollowStates = (first: FollowState, second: FollowState): FollowState => ({
  models: [...new Set([...asStringList(first.models), ...asStringList(second.models)])],
  topics: [...new Set([...asStringList(first.topics), ...asStringList(second.topics)])],
});

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectFollowRow = async (client: HostedClient, userId: string): Promise<FollowRow | null> =>
  unwrap(await client.from("follows").select("*").eq("user_id", userId).maybeSingle(), null);

export const selectCityFollowRows = async (client: HostedClient, userId: string): Promise<CityFollowRow[]> =>
  unwrap(await client.from("city_follows").select("*").eq("user_id", userId), []);

export const loadHostedFollows = (
  userId: string | null | undefined,
  fallback: FollowState = emptyFollowState,
): Promise<HostedResult<FollowState>> =>
  runHostedForUser<FollowState>(userId, fallback, async (client, id) => {
    const row = await selectFollowRow(client, id);
    return row ? followRowToLocal(row) : fallback;
  });

export const saveHostedFollows = (userId: string | null | undefined, follows: FollowState) =>
  runHostedForUser<FollowState>(userId, follows, async (client, id) => {
    unwrapWrite(await client.from("follows").upsert(followStateToRow(id, follows), { onConflict: "user_id" }));
    return follows;
  });

export const listHostedCityFollows = (userId: string | null | undefined, fallback: HostedCityFollow[] = []) =>
  runHostedForUser<HostedCityFollow[]>(userId, fallback, async (client, id) =>
    (await selectCityFollowRows(client, id)).map(cityFollowRowToLocal),
  );

export const setHostedCityFollow = (
  userId: string | null | undefined,
  city: string,
  following: boolean,
  notify = true,
) =>
  runHostedForUser<boolean>(userId, following, async (client, id) => {
    const citySlug = slugify(city);
    if (!citySlug) return following;
    unwrapWrite(
      following
        ? await client
            .from("city_follows")
            .upsert(cityFollowToRow(id, { citySlug, notify }), { onConflict: "user_id,city_slug" })
        : await client.from("city_follows").delete().eq("user_id", id).eq("city_slug", citySlug),
    );
    return following;
  });
