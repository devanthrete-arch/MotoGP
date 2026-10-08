import { StrictMode } from "react";
import { ClerkProvider } from "@clerk/react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { applyThemePreference, readThemePreference } from "./theme";
import "./styles.css";

// Before first paint, so an explicit light or dark choice does not flash the other theme.
applyThemePreference(readThemePreference());

const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) as string | undefined;

const startupUrl = new URL(window.location.href);
if (startupUrl.searchParams.has("clerk_return")) {
  startupUrl.searchParams.delete("clerk_return");
  window.history.replaceState(window.history.state, "", `${startupUrl.pathname}${startupUrl.search}${startupUrl.hash}`);
}

const app = (
  <ErrorBoundary>
    <App clerkEnabled={Boolean(clerkPublishableKey)} />
  </ErrorBoundary>
);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {clerkPublishableKey ? <ClerkProvider publishableKey={clerkPublishableKey}>{app}</ClerkProvider> : app}
  </StrictMode>,
);
