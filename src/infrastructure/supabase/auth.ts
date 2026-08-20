import { getSupabaseClient } from "./client";

export type CloudUser = { email: string; id: string };

/* -------------------------------------------------------------------------- */
/* Auth helpers                                                                */
/*                                                                             */
/* The hosted data layer in src/infrastructure/hosted/* deliberately owns no auth. These three */
/* helpers are the only Supabase auth surface the app uses, and each one        */
/* degrades to a plain result instead of throwing, so a missing client or a     */
/* dropped connection can never reach a render.                                 */
/* -------------------------------------------------------------------------- */

export type AuthOutcome = { message: string; ok: boolean };

const authOk: AuthOutcome = { message: "", ok: true };

const describeAuthError = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "That did not work. Try again.";

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

export const requestSignInLink = async (email: string, redirectTo: string): Promise<AuthOutcome> => {
  try {
    const client = getSupabaseClient();
    if (!client) return { message: "Account sync is not configured for this build.", ok: false };
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    return error ? { message: describeAuthError(error), ok: false } : authOk;
  } catch (error) {
    return { message: describeAuthError(error), ok: false };
  }
};

export const signOutOfCloud = async (): Promise<AuthOutcome> => {
  try {
    const client = getSupabaseClient();
    if (!client) return authOk;
    const { error } = await client.auth.signOut();
    return error ? { message: describeAuthError(error), ok: false } : authOk;
  } catch (error) {
    return { message: describeAuthError(error), ok: false };
  }
};

