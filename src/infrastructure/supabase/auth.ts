import { getSupabaseClient } from "./client";

/**
 * Session read for the Supabase client.
 *
 * `infrastructure/hosted/*` deliberately owns no auth; this is the only place
 * the app asks who is signed in. Like the hosted layer it never throws — a
 * missing client, a missing session or a dropped connection all resolve to
 * `null`, so a signed-out or offline device renders the same local-first
 * workspace as a signed-in one.
 *
 * Sending the sign-in link and signing out live in
 * `infrastructure/cloud/cloudSync`, which owns the whole account-sync flow.
 */
export type CloudUser = { email: string; id: string };

export const readCloudUser = async (): Promise<CloudUser | null> => {
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    const user = data.session?.user;
    return user ? { email: user.email ?? "Signed-in user", id: user.id } : null;
  } catch {
    return null;
  }
};
