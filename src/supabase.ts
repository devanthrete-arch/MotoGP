import { createClient } from "@supabase/supabase-js";

export type CloudConfig = { url: string; publishableKey: string };
export type ClerkTokenGetter = () => Promise<string | null>;
type TokenSession = { id: string; user: { id: string }; getToken: ClerkTokenGetter };

export function sessionTokenGetter(session: TokenSession, activeSession: () => TokenSession | null | undefined): ClerkTokenGetter {
  const check = () => {
    const active = activeSession();
    if (active?.id !== session.id || active.user.id !== session.user.id) throw new Error("Your sign-in changed. Please retry.");
  };
  return async () => {
    check();
    const token = await session.getToken();
    check();
    return token;
  };
}

export function readCloudConfig(env: Record<string, unknown>): CloudConfig | null {
  const url = String(env.VITE_SUPABASE_URL ?? "").trim();
  const publishableKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) throw new Error("Supabase URL and publishable key must both be configured.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Supabase URL must be an HTTPS project origin.");
  }
  let isPublicKey = publishableKey.startsWith("sb_publishable_");
  if (!isPublicKey) {
    try {
      const payload = publishableKey.split(".")[1];
      const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      isPublicKey = claims.role === "anon";
    } catch { /* Only publishable keys or legacy anon keys belong in a browser build. */ }
  }
  if (!isPublicKey) throw new Error("Use a Supabase publishable key, never a secret or service-role key in the browser.");
  return { url: parsed.origin, publishableKey };
}

export function createClerkSupabaseClient(config: CloudConfig, getToken: ClerkTokenGetter) {
  return createClient(config.url, config.publishableKey, {
    // Request a current Clerk token for each operation, including after session refresh.
    accessToken: async () => {
      const token = await getToken();
      if (!token) throw new Error("Sign in before accessing your cloud data.");
      return token;
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
