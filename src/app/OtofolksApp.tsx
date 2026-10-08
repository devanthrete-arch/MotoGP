// The app shell: builds the shared state once and lays out the frame and the views.
import type { AppAuthState, AppProps } from "./model";
import { LoginGate } from "./auth";
import { AppFooter, AppHeader, ConnectionStrip, DataNotice, TabBar, ToastRegion } from "./Shell";
import { OtofolksProvider, useOtofolksState } from "./state";
import { AccountView } from "./views/AccountView";
import { CompareView } from "./views/CompareView";
import { FeedView } from "./views/FeedView";
import { GarageView } from "./views/GarageView";
import { HomeView } from "./views/HomeView";
import { PitStopView, ReelModal } from "./views/PitStopView";
import { WriteView } from "./views/WriteView";

export function OtofolksApp(props: AppProps & { auth: AppAuthState }) {
  const state = useOtofolksState(props);
  const { auth, clerkEnabled, activeView, shouldShowFeatures } = state;
  return (
    <OtofolksProvider value={state}>
      <main className="app-shell">
        <AppHeader />
        <HomeView />
        <AccountView />
        <ToastRegion />
        <ConnectionStrip />
        {shouldShowFeatures ? (
          <>
            <DataNotice />
            <FeedView />
            <PitStopView />
            <CompareView />
            <WriteView />
            <GarageView />
          </>
        ) : (
          activeView !== "top" && activeView !== "account" ? (
            clerkEnabled ? <LoginGate isLoaded={auth.isLoaded} /> :
            <section className="panel auth-gate"><h2>Sign-in is temporarily unavailable</h2><p>Please try again later.</p></section>
          ) : null
        )}
        <AppFooter />
        <ReelModal />
        <TabBar />
      </main>
    </OtofolksProvider>
  );
}
