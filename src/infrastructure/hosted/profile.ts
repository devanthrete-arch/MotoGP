import type { Profile } from "../../core/entities";
import { asOneOf, asText } from "./kernel/coerce";
import { type HostedClient, type HostedResult, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { Insert, ProfileRow } from "../supabase/tables";

export const garageRoleValues = ["Owner", "Buyer", "Enthusiast", "Mechanic"] as const;

export const emptyProfile: Profile = { city: "", displayName: "", garageRole: "Owner" };

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const profileRowToLocal = (row: Pick<ProfileRow, "city" | "display_name" | "garage_role">): Profile => ({
  city: asText(row.city),
  displayName: asText(row.display_name),
  garageRole: asOneOf(row.garage_role, garageRoleValues, "Owner"),
});

export const profileToRow = (userId: string, profile: Profile): Insert<"profiles"> => ({
  city: asText(profile.city).slice(0, 100),
  display_name: asText(profile.displayName).slice(0, 80),
  garage_role: asOneOf(profile.garageRole, garageRoleValues, "Owner"),
  user_id: userId,
});

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectProfileRow = async (client: HostedClient, userId: string): Promise<ProfileRow | null> =>
  unwrap(await client.from("profiles").select("*").eq("user_id", userId).maybeSingle(), null);

export const loadHostedProfile = (userId: string | null | undefined, fallback: Profile = emptyProfile) =>
  runHostedForUser<Profile>(userId, fallback, async (client, id) => {
    const row = await selectProfileRow(client, id);
    return row ? profileRowToLocal(row) : fallback;
  });

export const saveHostedProfile = (
  userId: string | null | undefined,
  profile: Profile,
): Promise<HostedResult<Profile>> =>
  runHostedForUser<Profile>(userId, profile, async (client, id) => {
    unwrapWrite(await client.from("profiles").upsert(profileToRow(id, profile), { onConflict: "user_id" }));
    return profile;
  });
