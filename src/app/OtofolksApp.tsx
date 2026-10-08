// The app shell: builds the shared state once, lays out the frame, and routes to one view.
import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import {
  type AppAuthState, type AppProps, type AppView, type MemberView, memberViews, pathForLegacyHash, viewPaths, viewTitles,
} from "./model";
import { fetchedView, ViewBoundary } from "./fetched";
import { AppFooter, AppHeader, ConnectionStrip, DataNotice, TabBar, ToastRegion, ViewLoading } from "./Shell";
import { SignInPrompt } from "./SignInPrompt";
import { OtofolksProvider, useOtofolksState } from "./state";
import { AccountView } from "./views/AccountView";
import { LandingView } from "./views/LandingView";

// The landing page and Account ship with the shell: they are what a visitor meets first. Every
// other view is fetched when it is first opened and, once the page is idle, quietly ahead of time:
// all of them for a signed-in member, only the ones open to everyone for a visitor.
const views = {
  // A member's front page. Only members ever see it, so only they download it.
  Home: fetchedView(() => import("./views/HomeView"), (module) => module.HomeView),
  Compare: fetchedView(() => import("./views/CompareView"), (module) => module.CompareView),
  Feed: fetchedView(() => import("./views/FeedView"), (module) => module.FeedView),
  Garage: fetchedView(() => import("./views/GarageView"), (module) => module.GarageView),
  PitStop: fetchedView(() => import("./views/PitStopView"),
    ({ PitStopView, ReelModal }) => () => <><PitStopView /><ReelModal /></>),
  Write: fetchedView(() => import("./views/WriteView"), (module) => module.WriteView),
  OwnerOnboarding: fetchedView(() => import("./views/OwnerOnboardingView"), (module) => module.OwnerOnboardingView),
  Guides: fetchedView(() => import("./views/GuidesView"), (module) => module.GuidesView),
};
// The file behind each view that is fetched ahead. Home is asked for separately, below.
const viewFiles: Partial<Record<AppView, (typeof views)[keyof typeof views]>> = {
  compare: views.Compare, feed: views.Feed, garage: views.Garage, "pit-stop": views.PitStop, write: views.Write,
  "owner-onboarding": views.OwnerOnboarding,
  guides: views.Guides,
};

function preloadViews(forMember: boolean) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  // Not on a connection the visitor has asked to spare, and not while there is none.
  if (connection?.saveData || !navigator.onLine) return;
  for (const [view, file] of Object.entries(viewFiles)) {
    if (forMember || !memberViews.has(view as AppView)) file.preload();
  }
}

// The view the reader was last put in front of, or null after the error panel. It starts as the
// view the app opened on, whether or not that view's file has arrived yet.
type Shown = AppView | null;

/**
 * Runs once a routed view is on screen. A link click no longer moves the browser's own focus the
 * way a fragment link did, so this moves it to the new view's heading.
 */
function RouteArrival({ view, shown }: { view: AppView; shown: RefObject<Shown> }) {
  useEffect(() => {
    const previous = shown.current;
    shown.current = view;
    // On first load the browser's own starting point is right; only a change of view moves focus.
    if (previous === view) return;
    const heading = document.querySelector<HTMLElement>(
      "main.app-shell > section:not([hidden]):not(.connection-strip) :is(h1, h2, h3)");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [view, shown]);
  return null;
}

function AppFrame(props: AppProps & { auth: AppAuthState }) {
  const state = useOtofolksState(props);
  const { activeView, audience, visitorPages } = state;
  const location = useLocation();
  const shown = useRef<Shown>(activeView);

  // Named from the address, not from the view, so the tab is right while a view is still loading.
  useEffect(() => {
    document.title = viewTitles[activeView];
  }, [activeView]);

  // A visitor is never sent the views they cannot open. While it is not yet known who is here,
  // nothing is fetched ahead for a device that was signed in before.
  const fetchAhead = audience === "member" ? "all" : visitorPages ? "open" : "none";
  // Home is where a member starts, so it is asked for at once, even while sign-in is still loading
  // on a device that was signed in before. A visitor never downloads it.
  const expectMember = audience === "member" || !visitorPages;
  useEffect(() => {
    if (expectMember) views.Home.preload();
  }, [expectMember]);
  useEffect(() => {
    if (fetchAhead === "none") return;
    const preload = () => preloadViews(fetchAhead === "all");
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(preload);
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(preload, 1500);
    return () => window.clearTimeout(handle);
  }, [fetchAhead]);

  const page = (view: AppView, content: ReactNode) => <>{content}<RouteArrival view={view} shown={shown} /></>;
  // The one place that decides what an address shows to whom. memberViews (model.tsx) says which
  // views need an account; a visitor gets a sign-in prompt in their place, at the same address, so
  // signing in brings them straight back to the view.
  const route = (view: AppView, content: ReactNode) => {
    if (audience === "member") return page(view, content);
    if (memberViews.has(view)) {
      return page(view, audience === "unknown" ? <ViewLoading /> : <SignInPrompt view={view as MemberView} />);
    }
    // Open to everyone, but not the same for everyone: a returning member waits for sign-in to
    // load rather than see (or add to) a visitor's version for a moment.
    return page(view, visitorPages ? content : <ViewLoading />);
  };

  return (
    <OtofolksProvider value={state}>
      <main className="app-shell">
        <AppHeader />
        <ToastRegion />
        <ConnectionStrip />
        <DataNotice />
        {/* Always mounted, shown only at its own address: see AccountView. */}
        <AccountView />
        <ViewBoundary resetKey={location.key} onFail={() => { shown.current = null; }}>
          <Suspense fallback={<ViewLoading />}>
            <Routes>
              <Route path={viewPaths.top} element={route("top", audience === "member" ? <views.Home /> : <LandingView />)} />
              <Route path={viewPaths.account} element={page("account", null)} />
              <Route path={viewPaths["owner-onboarding"]} element={route("owner-onboarding", <views.OwnerOnboarding />)} />
              <Route path={viewPaths.garage} element={route("garage", <views.Garage />)} />
              <Route path={viewPaths.feed} element={route("feed", <views.Feed />)} />
              <Route path={viewPaths.write} element={route("write", <views.Write />)} />
              {/* Pit Stop holds nothing of the reader's, so it never has to wait to know who they are. */}
              <Route path={viewPaths["pit-stop"]} element={page("pit-stop", <views.PitStop />)} />
              <Route path={viewPaths.compare} element={route("compare", <views.Compare />)} />
              <Route path={`${viewPaths.guides}/:slug?`} element={page("guides", <views.Guides />)} />
              <Route path="*" element={<Navigate to={viewPaths.top} replace />} />
            </Routes>
          </Suspense>
        </ViewBoundary>
        <AppFooter />
        <TabBar />
      </main>
    </OtofolksProvider>
  );
}

// A visitor arriving by a link in the old fragment form (/#feed) is moved to the matching path
// before the router reads the address, so they never see Home first. Any query string is kept.
function adoptLegacyAddress() {
  if (typeof window === "undefined" || window.location.pathname !== "/") return;
  const target = pathForLegacyHash(window.location.hash);
  if (!target) return;
  const address = new URL(window.location.href);
  address.pathname = target.pathname;
  address.hash = target.hash;
  window.history.replaceState(window.history.state, "", address);
}

export function OtofolksApp(props: AppProps & { auth: AppAuthState }) {
  // An initialiser runs before the first render and not again.
  useState(adoptLegacyAddress);
  return (
    // Without transitions a view that is still being fetched shows its placeholder at once,
    // instead of leaving the previous page on screen with no sign that anything happened.
    <BrowserRouter useTransitions={false}>
      <AppFrame {...props} />
    </BrowserRouter>
  );
}
