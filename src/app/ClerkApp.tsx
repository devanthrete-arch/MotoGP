// Connects Clerk's session to the app and falls back to a signed-out app when Clerk is not configured.
import { useEffect, useMemo, useState } from "react";
import { useClerk, useUser, useSession } from "@clerk/react";
import { createClerkSupabaseClient, readCloudConfig, sessionTokenGetter } from "../supabase";
import type { AppProps } from "./model";
import { clerkReturnUrl } from "./auth";
import { OtofolksApp } from "./OtofolksApp";

export const ClerkConnectedApp = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();
  const clerk = useClerk();
  const cloud = useMemo(() => {
    try {
      const config = readCloudConfig(import.meta.env);
      const getToken = config && session ? sessionTokenGetter(session, () => clerk.session) : null;
      return { client: config && getToken ? createClerkSupabaseClient(config, getToken) : null, getToken };
    } catch {
      return { client: null, error: "Account saving is temporarily unavailable. Your data stays on this device." };
    }
  }, [clerk, session]);
  const [pendingSignIn, setPendingSignIn] = useState<string | null>(null);
  useEffect(() => {
    if (!isLoaded || !pendingSignIn) return;
    setPendingSignIn(null);
    if (!isSignedIn) void clerk.openSignIn({ forceRedirectUrl: clerkReturnUrl(pendingSignIn) });
  }, [clerk, isLoaded, isSignedIn, pendingSignIn]);

  return (
    <OtofolksApp
      key={session?.id ?? user?.id ?? "signed-out"}
      auth={{
        userId: user?.id,
        cloudClient: cloud.client,
        cloudToken: cloud.getToken,
        cloudError: cloud.error,
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        requireSignIn: (destination = "/") => {
          setPendingSignIn(destination);
        },
      }}
      clerkEnabled
    />
  );
};

export function App({ clerkEnabled = false }: AppProps) {
  if (clerkEnabled) return <ClerkConnectedApp />;

  return (
    <OtofolksApp
      auth={{
        isLoaded: true,
        isSignedIn: false,
        requireSignIn: () => undefined,
      }}
      clerkEnabled={false}
    />
  );
}
