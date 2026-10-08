// The app shell: builds the shared state once, lays out the frame, and routes to one view.
import { Component, Suspense, use, useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode, RefObject } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { LoginGate } from "./auth";
import { type AppAuthState, type AppProps, type AppView, pathForLegacyHash, viewPaths, viewTitles } from "./model";
import { AppFooter, AppHeader, ConnectionStrip, DataNotice, TabBar, ToastRegion, ViewLoadError, ViewLoading } from "./Shell";
import { OtofolksProvider, useOtofolksState } from "./state";
import { AccountView } from "./views/AccountView";
import { HomeView } from "./views/HomeView";

/**
 * A view kept in its own file. React.lazy would do, but it remembers a failed download for good
 * and makes a view that has already arrived wait one more turn. This one can be told to forget a
 * failure, so the view is fetched again, and shows a downloaded view with no placeholder.
 */
function fetchedView<Module>(load: () => Promise<Module>, pick: (module: Module) => ComponentType) {
  let loaded: ComponentType | null = null;
  let request: Promise<ComponentType> | null = null;
  let failure: { error: unknown } | null = null;
  // Where to ask after a failure, when the first address can no longer be used: see freshAddress.
  let retryAddress: string | null = null;
  const start = () => (request ??= (retryAddress ? import(/* @vite-ignore */ retryAddress) as Promise<Module> : load()).then(
    (module) => (loaded = pick(module)),
    (error: unknown) => { failure = { error }; throw error; },
  ));
  const View = () => {
    const Loaded = loaded ?? use(start());
    return <Loaded />;
  };
  return Object.assign(View, {
    preload: () => { start().catch(() => { /* Shown to the member only if they open the view. */ }); },
    forgetFailure: () => {
      if (!failure) return;
      retryAddress = freshAddress(failure.error);
      failure = null;
      request = null;
    },
  });
}

// Chromium keeps a failed module download for as long as the page stays open, so asking for the
// same address again fails at once without touching the network. Its error names the address, and
// the same file under an extra query string is a new request. Other browsers simply fetch again.
function freshAddress(error: unknown) {
  const named = /https?:\/\/\S+/.exec(error instanceof Error ? error.message : "")?.[0];
  if (!named) return null;
  try {
    const address = new URL(named);
    if (address.origin !== window.location.origin) return null;
    address.searchParams.set("retry", String(Date.now()));
    return address.href;
  } catch {
    return null;
  }
}

// Home and Account ship with the shell. Every other view is fetched when it is first opened and,
// for a signed-in member, quietly ahead of time once the page is idle.
const views = {
  Compare: fetchedView(() => import("./views/CompareView"), (module) => module.CompareView),
  Feed: fetchedView(() => import("./views/FeedView"), (module) => module.FeedView),
  Garage: fetchedView(() => import("./views/GarageView"), (module) => module.GarageView),
  PitStop: fetchedView(() => import("./views/PitStopView"),
    ({ PitStopView, ReelModal }) => () => <><PitStopView /><ReelModal /></>),
  Write: fetchedView(() => import("./views/WriteView"), (module) => module.WriteView),
};

function preloadViews() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  // Not on a connection the visitor has asked to spare, and not while there is none.
  if (connection?.saveData || !navigator.onLine) return;
  for (const view of Object.values(views)) view.preload();
}

function forgetFailedViews() {
  for (const view of Object.values(views)) view.forgetFailure();
}

type ViewBoundaryProps = { resetKey: string; onFail: () => void; children: ReactNode };
type ViewBoundaryState = { failed: boolean; resetKey: string };

/** Keeps a view that could not be shown from taking the header and navigation down with it. */
class ViewBoundary extends Component<ViewBoundaryProps, ViewBoundaryState> {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: ViewBoundaryProps, state: ViewBoundaryState) {
    if (props.resetKey === state.resetKey) return null;
    // Every navigation, a second tap on the same link included, clears the error and lets a view
    // whose download failed be fetched afresh. Runs before the page renders, and doing it twice
    // changes nothing.
    forgetFailedViews();
    return { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  retry = () => {
    forgetFailedViews();
    this.setState({ failed: false });
  };

  render() {
    return this.state.failed ? <ViewLoadError onRetry={this.retry} /> : this.props.children;
  }
}

// What is on screen in the routed area: a view, null for the error panel, undefined before the
// first view has appeared.
type Shown = AppView | null | undefined;

/**
 * Runs once a routed view is on screen. A link click no longer moves the browser's own focus the
 * way a fragment link did, so this moves it to the new view's heading.
 */
function RouteArrival({ view, shown }: { view: AppView; shown: RefObject<Shown> }) {
  useEffect(() => {
    const previous = shown.current;
    shown.current = view;
    // On first load the browser's own starting point is right; only a change of view moves focus.
    if (previous === undefined || previous === view) return;
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
  const { activeView, auth, clerkEnabled, shouldShowFeatures } = state;
  const location = useLocation();
  const shown = useRef<Shown>(undefined);

  // Named from the address, not from the view, so the tab is right while a view is still loading.
  useEffect(() => {
    document.title = viewTitles[activeView];
  }, [activeView]);

  useEffect(() => {
    // Visitors who are not signed in cannot open these views, so nothing is fetched for them.
    if (!shouldShowFeatures) return;
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(preloadViews);
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(preloadViews, 1500);
    return () => window.clearTimeout(handle);
  }, [shouldShowFeatures]);

  const page = (view: AppView, content: ReactNode) => <>{content}<RouteArrival view={view} shown={shown} /></>;
  // Everything except Home and Account needs an account.
  const members = (view: AppView, content: ReactNode) => {
    if (shouldShowFeatures) return page(view, content);
    return page(view, clerkEnabled ? <LoginGate isLoaded={auth.isLoaded} />
      : <section className="panel auth-gate"><h2>Sign-in is temporarily unavailable</h2><p>Please try again later.</p></section>);
  };

  return (
    <OtofolksProvider value={state}>
      <main className="app-shell">
        <AppHeader />
        <ToastRegion />
        <ConnectionStrip />
        {shouldShowFeatures ? <DataNotice /> : null}
        {/* Always mounted, shown only at its own address: see AccountView. */}
        <AccountView />
        <ViewBoundary resetKey={location.key} onFail={() => { shown.current = null; }}>
          <Suspense fallback={<ViewLoading />}>
            <Routes>
              <Route path={viewPaths.top} element={page("top", <HomeView />)} />
              <Route path={viewPaths.account} element={page("account", null)} />
              <Route path={viewPaths.garage} element={members("garage", <views.Garage />)} />
              <Route path={viewPaths.feed} element={members("feed", <views.Feed />)} />
              <Route path={viewPaths.write} element={members("write", <views.Write />)} />
              <Route path={viewPaths["pit-stop"]} element={members("pit-stop", <views.PitStop />)} />
              <Route path={viewPaths.compare} element={members("compare", <views.Compare />)} />
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
