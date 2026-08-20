import { AppStateProvider, useApp } from "./state/appState";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { ErrorState, LiveRegion } from "../ui";
import { MobileDock, Sidebar, Topbar, WorkspaceHeader } from "./shell/Shell";
import { Account } from "./screens/Account";
import { Analytics } from "./screens/Analytics";
import { CommunityFeed } from "./screens/CommunityFeed";
import { Compare } from "./screens/Compare";
import { CreatorConnect } from "./screens/CreatorConnect";
import { DocVault } from "./screens/DocVault";
import { Garage } from "./screens/Garage";
import { Home } from "./screens/Home";
import { Kyv } from "./screens/Kyv";

/**
 * App shell composition: Obsidian Velocity chrome (sidebar rail on desktop,
 * topbar, bottom dock on mobile) around per-screen modules in src/screens/.
 * All state, storage, and routing logic lives in appState.tsx.
 */
function AppFrame() {
  const app = useApp();
  const { activeScreen, isOnline, actionMessage } = app;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="min-h-screen bg-background text-on-surface" data-screen={activeScreen}>
        <Sidebar />
        <div className="lg:pl-60 flex flex-col min-h-screen">
          <Topbar />
          {!isOnline ? (
            <ErrorState message="You are offline. Saved records remain available on this device." variant="banner" />
          ) : null}
          <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 lg:px-10 pb-28 lg:pb-12" id="main-content">
            <WorkspaceHeader />
            {activeScreen === "home" ? <Home /> : null}
            {activeScreen === "community" ? <CommunityFeed /> : null}
            {activeScreen === "shortlist" ? <Compare /> : null}
            {activeScreen === "garage" ? <Garage /> : null}
            {activeScreen === "account" ? <Account /> : null}
            {activeScreen === "kyv" ? <Kyv /> : null}
            {activeScreen === "vault" ? <DocVault /> : null}
            {activeScreen === "analytics" ? <Analytics /> : null}
            {activeScreen === "creators" ? <CreatorConnect /> : null}
          </main>
        </div>
        <MobileDock />
        {/* Always mounted: a live region inserted at the same moment as its
            text is frequently never announced, so the node stays and only the
            message changes. */}
        <LiveRegion className="action-message" message={actionMessage} />
      </div>
    </>
  );
}

export function App() {
  // The boundary wraps the provider, not just the frame: storage reads and route
  // parsing run inside AppStateProvider, so a crash there has to land on the
  // recovery screen rather than an empty <div id="root">.
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <AppFrame />
      </AppStateProvider>
    </ErrorBoundary>
  );
}
