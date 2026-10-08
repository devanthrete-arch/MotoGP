import { expect, type Page } from "@playwright/test";

export type AppOptions = {
  /** Sign-in is configured (the default, as in production). False shows the "temporarily unavailable" state. */
  clerkEnabled?: boolean;
  /** The sign-in provider has answered. False holds the app in the moment before it is known who is here. */
  isLoaded?: boolean;
  /** Which account is signed in, when one is. */
  userId?: string;
};

const errorsByPage = new WeakMap<Page, string[]>();

/** Uncaught errors seen on the page since it was first opened with openApp. */
export const pageErrors = (page: Page) => errorsByPage.get(page) ?? [];

/**
 * Opens the app shell without a live Clerk account: the entry file is swapped for one that mounts
 * OtofolksApp with a stand-in for sign-in. Every sign-in request is recorded on the page as
 * "<path to return to> <sign-in|sign-up>" in window.signInRequests.
 *
 * Calling it again on the same page is how a test "signs in": a real sign-in also ends in a full
 * page load, so everything that must survive it has to live in storage, exactly as here.
 */
export async function openApp(page: Page, signedIn: boolean, path = "/", cloud = false,
  { clerkEnabled = true, isLoaded = true, userId = "browser-test-user" }: AppOptions = {}) {
  if (!errorsByPage.has(page)) {
    const errors: string[] = [];
    errorsByPage.set(page, errors);
    page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  }
  await page.unroute("**/src/main.tsx*");
  await page.route("**/src/main.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: `import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import { OtofolksApp } from '/src/App.tsx';
      ${cloud ? "import { createClerkSupabaseClient } from '/src/supabase.ts';" : ""}
      import '/src/styles.css';
      ${cloud ? "const token = async () => 'test-clerk-token'; const client = createClerkSupabaseClient({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_fixture' }, token);" : ""}
      window.signInRequests = [];
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(OtofolksApp, {
        clerkEnabled: ${clerkEnabled},
        auth: { userId: ${signedIn ? JSON.stringify(userId) : 'undefined'}, isLoaded: ${isLoaded}, isSignedIn: ${signedIn},
          ${cloud ? "cloudClient: client, cloudToken: token," : ""}
          requireSignIn: (destination, mode = 'sign-in') => {
            window.signInRequested = true;
            window.signInRequests.push(destination + ' ' + mode);
          } }
      }));`,
  }));
  await page.goto(path);
  await expect(page.getByRole("navigation", {
    name: (page.viewportSize()?.width ?? 1440) <= 860 ? "Primary" : "Primary navigation",
    exact: true,
  })).toBeVisible();
}

export const signInRequests = (page: Page) =>
  page.evaluate(() => (window as unknown as { signInRequests: string[] }).signInRequests);

export async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// The parts of the app that are separate files, fetched apart from the first load: the views a
// visitor may open, and what only a signed-in member ever needs.
export const openViews = ["CompareView", "GuidesView", "PitStopView"];
export const memberOnlyViews = ["CloudWorkspacePanel", "FeedView", "GarageView", "HomeView", "WriteView"];
export const fetchedViews = [...openViews, ...memberOnlyViews].sort();

/** Records which view files the page asks the dev server for. */
export function recordViewRequests(page: Page) {
  const fetched = new Set<string>();
  page.on("request", request => {
    const name = fetchedViews.find(view => new URL(request.url()).pathname.endsWith(`/${view}.tsx`));
    if (name) fetched.add(name);
  });
  return () => [...fetched].sort();
}

/** Waits until the page has been idle, which is when views are fetched ahead, and for what that started. */
export async function afterIdle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => { window.requestIdleCallback(() => resolve()); }));
  await page.waitForLoadState("networkidle");
}
