import { PostgrestClient } from "@supabase/postgrest-js";

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

// The app only reads and writes tables and calls database functions, so it talks to the project's
// REST endpoint directly. The full Supabase SDK also bundles auth, storage and realtime clients
// (about two-fifths of the old bundle), none of which are used: Clerk handles sign-in.
export type CloudClient = PostgrestClient;

export function createClerkSupabaseClient(config: CloudConfig, getToken: ClerkTokenGetter): CloudClient {
  return new PostgrestClient(`${config.url}/rest/v1`, {
    headers: { apikey: config.publishableKey },
    // Request a current Clerk token for each operation, including after session refresh. With no
    // token the request is never sent, so there is no anonymous fallback after sign-out.
    fetch: async (input, init) => {
      const token = await getToken();
      if (!token) throw new Error("Sign in before accessing your cloud data.");
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
  });
}
