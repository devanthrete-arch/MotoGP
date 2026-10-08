import { expect, test, type Page } from "@playwright/test";

// Exercise the app's auth boundary without depending on a live Clerk account.
async function openApp(page: Page, signedIn: boolean, path = "/", cloud = false) {
  page.on("pageerror", error => console.error(error.message));
  await page.route("**/src/main.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: `import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import { OtofolksApp } from '/src/App.tsx';
      ${cloud ? "import { createClerkSupabaseClient } from '/src/supabase.ts';" : ""}
      import '/src/styles.css';
      ${cloud ? "const token = async () => 'test-clerk-token'; const client = createClerkSupabaseClient({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_fixture' }, token);" : ""}
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(OtofolksApp, {
        auth: { userId: 'browser-test-user', isLoaded: true, isSignedIn: ${signedIn},
          ${cloud ? "cloudClient: client, cloudToken: token," : ""}
          requireSignIn: () => { window.signInRequested = true; } }
      }));`,
  }));
  await page.goto(path);
  await expect(page.getByRole("navigation", {
    name: (page.viewportSize()?.width ?? 1440) <= 860 ? "Primary" : "Primary navigation",
    exact: true,
  })).toBeVisible();
}

// Each view has its own path; the section keeps its element id.
const viewPaths = { garage: "/garage", feed: "/community", "pit-stop": "/pit-stop", compare: "/compare" } as const;

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [320, 390, 768, 1440, 1920]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${width}px ${colorScheme}: home and feature layouts`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await openApp(page, true);
      await expectNoOverflow(page);
      const images = page.locator(".service-screens img");
      for (const img of await images.all()) {
        await expect(img).toHaveJSProperty("complete", true);
        expect(await img.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
      }
      await page.screenshot({ path: `test-results/home-${width}-${colorScheme}.png`, fullPage: true });
      for (const id of ["garage", "feed", "pit-stop", "compare"] as const) {
        const navigation = width <= 860 ? page.locator(".tab-bar") : page.locator("#primary-nav-links");
        await navigation.locator(`a[href='${viewPaths[id]}']`).click();
        await expect(page.locator(`#${id}`)).toBeVisible();
        await expect(page.locator(".home-view")).toBeHidden();
        for (const other of ["garage", "feed", "pit-stop", "compare"].filter(value => value !== id)) {
          await expect(page.locator(`#${other}`)).toBeHidden();
        }
        await expectNoOverflow(page);
        await page.screenshot({ path: `test-results/${id}-${width}-${colorScheme}.png`, fullPage: true });
      }
      await page.goBack();
      await expect(page.locator("#pit-stop")).toBeVisible();
      await page.reload();
      await expect(page.locator("#pit-stop")).toBeVisible();
    });
  }
}

test("mobile tab bar tracks the active view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, true);
  const tabs = page.getByRole("navigation", { name: "Primary", exact: true });
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await tabs.locator("a[href='/community']").click();
  await expect(tabs.locator("a[href='/community']")).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(tabs).toBeVisible();
  // The tab for the page already open takes the reader back to its top.
  await expect(page.locator("#feed")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 300));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await tabs.locator("a[href='/community']").click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("each view has its own address that survives reload, back and forward", async ({ page }) => {
  await openApp(page, true, "/community/write");
  await expect(page.locator("#write")).toBeVisible();
  // Only the view for the current address is in the page; Account stays mounted, out of sight.
  for (const other of ["garage", "feed", "pit-stop", "compare"]) await expect(page.locator(`#${other}`)).toHaveCount(0);
  await expect(page.locator(".home-view")).toHaveCount(0);
  await expect(page.locator("#account")).toHaveCount(1);
  await expect(page.locator("#account")).toBeHidden();
  await page.reload();
  await expect(page.locator("#write")).toBeVisible();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My garage" }).click();
  await expect(page).toHaveURL(/\/garage$/);
  await expect(page.locator("#garage")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/community\/write$/);
  await expect(page.locator("#write")).toBeVisible();
  await page.goForward();
  await expect(page.locator("#garage")).toBeVisible();

  // An address that is not a view goes home rather than showing a blank page.
  await page.goto("/no-such-page");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".home-view")).toBeVisible();

  // An address typed in another letter case still opens its view and marks it in the navigation.
  await page.goto("/Garage");
  await expect(page.locator("#garage")).toBeVisible();
  await expect(page.locator("#primary-nav-links a[aria-current='page']")).toHaveText("My garage");
});

test("links in the old fragment form still land on the right view", async ({ page }) => {
  // Records whether Home was put on screen at any point during a page load.
  await page.addInitScript(() => {
    const seen = window as unknown as { sawHome: boolean };
    seen.sawHome = false;
    new MutationObserver(() => { if (document.querySelector(".home-view")) seen.sawHome = true; })
      .observe(document, { childList: true, subtree: true });
  });
  await openApp(page, true, "/account");
  await page.goto("/#garage");
  await expect(page).toHaveURL(/\/garage$/);
  await expect(page.locator("#garage")).toBeVisible();
  // The visitor goes straight there, without Home appearing on the way.
  expect(await page.evaluate(() => (window as unknown as { sawHome: boolean }).sawHome)).toBe(false);
  // The old address was replaced, not stacked, so Back returns to the page before it.
  await page.goBack();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator("#account")).toBeVisible();

  for (const [legacy, address, view] of [["/#feed", /\/community$/, "#feed"], ["/#write", /\/community\/write$/, "#write"],
    ["/#compare", /\/compare$/, "#compare"], ["/#pit-stop", /\/pit-stop$/, "#pit-stop"]] as const) {
    await page.goto("/account");
    await page.goto(legacy);
    await expect(page).toHaveURL(address);
    await expect(page.locator(view)).toBeVisible();
  }

  // A Pit Stop collection link keeps its collection.
  await page.goto("/account");
  await page.goto("/#pit-stop-builds");
  await expect(page).toHaveURL(/\/pit-stop#pit-stop-builds$/);
  await expect(page.locator(".pit-stop-filters").getByRole("button", { name: "Builds" })).toHaveAttribute("aria-pressed", "true");

  // A fragment that is not an old view name is left exactly as it is.
  for (const fragment of ["#top", "#/sso-callback"]) {
    await page.goto("/account");
    await page.goto(`/${fragment}`);
    await expect(page.locator(".home-view")).toBeVisible();
    expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe(`/${fragment}`);
  }

  // A query string on an old link is carried over.
  await page.goto("/account");
  await page.goto("/?ref=mail#feed");
  await expect(page).toHaveURL(/\/community\?ref=mail$/);
  await expect(page.locator("#feed")).toBeVisible();

  // A fragment that turns up while the app is already open is honoured too.
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#compare"; });
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.locator("#compare")).toBeVisible();
});

// The views that are separate files, fetched apart from the first load.
const lazyViews = ["CompareView", "FeedView", "GarageView", "PitStopView", "WriteView"];
function recordViewRequests(page: Page) {
  const fetched = new Set<string>();
  page.on("request", request => {
    const name = lazyViews.find(view => new URL(request.url()).pathname.endsWith(`/src/app/views/${view}.tsx`));
    if (name) fetched.add(name);
  });
  return () => [...fetched].sort();
}
// Waits until the page has been idle, which is when views are fetched ahead, and for what that started.
async function afterIdle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => { window.requestIdleCallback(() => resolve()); }));
  await page.waitForLoadState("networkidle");
}

test("a visitor who is not signed in downloads no member view", async ({ page }) => {
  const fetched = recordViewRequests(page);
  await openApp(page, false);
  await expect(page.locator(".home-view")).toBeVisible();
  await afterIdle(page);
  await page.goto("/compare");
  await expect(page.locator(".auth-gate")).toBeVisible();
  await afterIdle(page);
  expect(fetched()).toEqual([]);
});

test("with Save-Data on, a member's view is fetched only when it is opened", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } }));
  const fetched = recordViewRequests(page);
  await openApp(page, true);
  await expect(page.locator(".home-view")).toBeVisible();
  await afterIdle(page);
  expect(fetched()).toEqual([]);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Compare" }).click();
  await expect(page.locator("#compare")).toBeVisible();
  expect(fetched()).toEqual(["CompareView"]);
});

test("a member's views are fetched ahead of time without holding up the page on screen", async ({ page }) => {
  const fetched = recordViewRequests(page);
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  await page.route("**/src/app/views/GarageView.tsx*", async route => { await held; await route.continue(); });
  await openApp(page, true);
  // Home is usable while a view's file is still on its way, and nobody has opened a view yet.
  await expect(page.locator(".home-view")).toBeVisible();
  await expect.poll(fetched).toEqual(lazyViews);
  // Opening the view that has not arrived shows its placeholder at once, then the view.
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My garage" }).click();
  await expect(page.locator(".view-loading")).toBeVisible();
  await expect(page.locator(".home-view")).toBeHidden();
  release();
  await expect(page.locator("#garage")).toBeVisible();
  await expect(page.locator(".view-loading")).toHaveCount(0);
});

test("a view that fails to download leaves the rest of the app working and can be tried again", async ({ page }) => {
  let offline = true;
  let requests = 0;
  await page.route("**/src/app/views/GarageView.tsx*", route => { requests++; return offline ? route.abort() : route.continue(); });
  await openApp(page, true);
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  const failure = page.getByRole("alert");
  await navigation.getByRole("link", { name: "My garage" }).click();
  await expect(failure).toContainText("This page did not load");
  await expect(page).toHaveURL(/\/garage$/);
  // The tab already names the page that was asked for.
  await expect(page).toHaveTitle("My garage · Otofolks");
  // Header and navigation are still there, and another view opens normally.
  await navigation.getByRole("link", { name: "Compare" }).click();
  await expect(page.locator("#compare")).toBeVisible();
  await expect(failure).toHaveCount(0);

  // Opening the failed view again asks for it again rather than repeating the old error.
  const before = requests;
  await navigation.getByRole("link", { name: "My garage" }).click();
  await expect(failure).toBeVisible();
  expect(requests).toBeGreaterThan(before);
  offline = false;
  await failure.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#garage")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your vehicles and maintenance" })).toBeFocused();
});

test("a new page starts at the top; Back returns to where the reader was", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, true, "/community");
  const tabs = page.getByRole("navigation", { name: "Primary", exact: true });
  await expect(page.locator("#feed")).toBeVisible();
  // Once the next view has been fetched ahead it replaces this one in a single step, with no
  // short placeholder in between to pull the page back to the top by itself.
  await afterIdle(page);
  await page.evaluate(() => window.scrollTo(0, 400));
  expect(await page.evaluate(() => window.scrollY)).toBe(400);
  await tabs.locator("a[href='/compare']").click();
  await expect(page.locator("#compare")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page.locator("#feed")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
});

test("moving to another view names it in the tab and puts keyboard focus on its heading", async ({ page }) => {
  await openApp(page, true);
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(page).toHaveTitle("Otofolks");
  // On first load the browser's own starting point is kept.
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  await navigation.getByRole("link", { name: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Which car feels right?" })).toBeFocused();
  await expect(page).toHaveTitle("Compare · Otofolks");
  // The next Tab continues inside the view rather than back at the top of the page.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("#compare") !== null)).toBe(true);

  await navigation.getByRole("link", { name: "Account" }).click();
  await expect(page.locator("#account :is(h2, h3)").first()).toBeFocused();
  await expect(page).toHaveTitle("Account · Otofolks");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Which car feels right?" })).toBeFocused();
  await expect(page).toHaveTitle("Compare · Otofolks");
  await navigation.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page).toHaveTitle("Otofolks");
});

test("a save to the account that is still running finishes after the member opens another view", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  let writes = 0;
  await page.route("https://example.supabase.co/rest/v1/**", async route => {
    const request = route.request();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type, prefer", "content-type": "application/json" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers });
    if (request.url().includes("save_otofolks_private_workspace")) {
      writes++;
      await held;
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ user_id: "browser-test-user",
        payload: request.postDataJSON().p_payload, revision: 1, updated_at: "2026-10-08T00:00:00Z" }) });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
  await openApp(page, true, "/account", true);
  const account = page.locator("#account");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await account.getByRole("button", { name: "Save to account", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await navigation.getByRole("link", { name: "My garage" }).click();
  await expect(page.locator("#garage")).toBeVisible();
  await expect(account).toBeHidden();
  release();
  await navigation.getByRole("link", { name: "Account" }).click();
  await expect(account.getByRole("status")).toHaveText("Saved to your account.");
  await expect(account.getByRole("button", { name: "Restore from account", exact: true })).toBeEnabled();
});

test("signed-out actions request login and never reveal feature data", async ({ page }) => {
  await openApp(page, false);
  const signInRequested = () => page.evaluate(() => (window as unknown as { signInRequested?: boolean }).signInRequested === true);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  expect(await signInRequested()).toBe(true);
  await page.evaluate(() => { (window as unknown as { signInRequested?: boolean }).signInRequested = false; });
  await page.getByRole("link", { name: "Ask the community" }).click();
  expect(await signInRequested()).toBe(true);
  // The visitor stays where they were.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".home-view")).toBeVisible();

  // Opening a member address directly shows the sign-in prompt in place of the view.
  for (const [path, id] of [["/garage", "garage"], ["/community", "feed"], ["/community/write", "write"],
    ["/pit-stop", "pit-stop"], ["/compare", "compare"]] as const) {
    await page.goto(path);
    await expect(page.locator(".auth-gate")).toBeVisible();
    await expect(page.locator(`#${id}`)).toHaveCount(0);
  }
});

test("vehicle and maintenance records survive reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, true, "/garage");
  const garage = page.locator("#garage");
  await expect(garage.getByRole("button", { name: "Add timeline note" })).toBeDisabled();
  await garage.getByPlaceholder("Nickname", { exact: true }).fill("Family car");
  await garage.getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  await garage.getByPlaceholder("What happened?").fill("Oil and filter replaced");
  await garage.getByPlaceholder("Amount paid").fill("4200");
  await garage.getByRole("button", { name: "Add timeline note" }).click();
  await page.reload();
  await expect(garage.locator(".timeline-board")).toContainText("Oil and filter replaced");
  await expect(garage.locator(".timeline-board")).toContainText("Family car");
  await expectNoOverflow(page);
  await page.screenshot({ path: "test-results/garage-with-maintenance.png", fullPage: true });
});

test("unavailable shared publishing preserves the draft and local examples stay distinct", async ({ page }) => {
  await openApp(page, true, "/community");
  await page.getByRole("link", { name: "Write an owner note" }).click();
  const composer = page.locator("#write");
  await composer.getByPlaceholder("Title", { exact: true }).fill("My service visit");
  await composer.getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await composer.locator("textarea").fill("The oil change cost 4200 rupees and resolved the noise.");
  await expect(composer.getByRole("button", { name: "Publish owner note" })).toBeDisabled();
  await expect(composer.getByPlaceholder("Title", { exact: true })).toHaveValue("My service visit");
  await page.getByRole("link", { name: "Community", exact: true }).last().click();
  await expect(page.locator("#feed")).toBeVisible();
  await expect(page.locator("#feed")).toContainText("Local example");
  await expect(page.getByRole("button", { name: "Add comment", exact: true })).toBeDisabled();
  await page.getByPlaceholder("Search brand, model, city, issue...").fill("no-matching-vehicle-ever");
  await expect(page.locator("#note-detail")).not.toContainText("Nexon");
});

test("shared note and reply publish through the Clerk-bound cloud client", async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  const comments: Record<string, unknown>[] = [];
  await page.route("https://example.supabase.co/rest/v1/**", async route => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split("/").pop();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type, prefer", "content-type": "application/json" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers });
    expect(request.headers().authorization).toBe("Bearer test-clerk-token");
    if (table === "community_posts") {
      if (request.method() === "POST") {
        const row = { ...request.postDataJSON(), id: "post-test-id", createdAt: "2026-10-07T00:00:00Z", status: "published" };
        posts.unshift(row);
        return route.fulfill({ status: 201, headers, body: JSON.stringify(row) });
      }
      return route.fulfill({ status: 200, headers, body: JSON.stringify(posts) });
    }
    if (table === "community_comments") {
      if (request.method() === "POST") {
        comments.unshift(request.postDataJSON());
        return route.fulfill({ status: 204, headers });
      }
      return route.fulfill({ status: 200, headers, body: JSON.stringify(comments) });
    }
    return route.fulfill({ status: 404, headers });
  });
  await openApp(page, true, "/community", true);
  await page.getByRole("link", { name: "Write an owner note" }).click();
  const composer = page.locator("#write");
  await composer.getByPlaceholder("Title", { exact: true }).fill("My service visit");
  await composer.getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await composer.locator("textarea").fill("The oil change cost 4200 rupees and resolved the noise.");
  await composer.getByRole("button", { name: "Publish owner note" }).click();
  await expect(page.locator("#note-detail")).toContainText("My service visit");
  // This stub has no ownership function, as before the hardening migration: no delete is offered.
  await expect(page.getByRole("button", { name: "Delete my note" })).toHaveCount(0);
  await page.locator("#note-detail .inline-form").first().locator("textarea").fill("Keep the invoice.");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(page.locator("#note-detail")).toContainText("Keep the invoice.");
  await page.reload();
  await page.locator("#feed .post-open").filter({ hasText: "My service visit" }).click();
  await expect(page.locator("#note-detail")).toContainText("Keep the invoice.");
});

test("toast clears itself and never covers the mobile tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, true, "/garage");
  const garage = page.locator("#garage");
  await garage.getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  const toast = page.locator(".action-message");
  await expect(toast).toHaveText("Vehicle saved on this device.");
  const tabs = page.getByRole("navigation", { name: "Primary", exact: true });
  const toastBox = await toast.boundingBox();
  const tabsBox = await tabs.boundingBox();
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(tabsBox!.y);
  await tabs.locator("a[href='/compare']").click();
  await expect(tabs.locator("a[href='/compare']")).toHaveAttribute("aria-current", "page");
  await expect(toast).toHaveCount(0, { timeout: 8000 });
});

test("theme switch overrides the system setting and survives reload; buttons are Geist pills", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openApp(page, true, "/garage");
  const html = page.locator("html");
  const pageColour = () => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  expect(await pageColour()).toBe("rgb(34, 43, 61)");

  await page.getByRole("button", { name: /^Theme: System/ }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await pageColour()).toBe("rgb(250, 248, 243)");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /^Theme: Light/ }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await pageColour()).toBe("rgb(34, 43, 61)");
  await page.getByRole("button", { name: /^Theme: Dark/ }).click();
  await expect(html).not.toHaveAttribute("data-theme", /.+/);

  // load() resolves with the matching faces once their files arrive; empty means the font is missing.
  expect(await page.evaluate(async () => Promise.all(['16px "Geist Variable"', '16px "Geist Mono Variable"']
    .map(async font => (await document.fonts.load(font)).length)))).toEqual([expect.any(Number), expect.any(Number)]);
  expect(await page.evaluate(() => ['16px "Geist Variable"', '16px "Geist Mono Variable"']
    .map(font => document.fonts.check(font)))).toEqual([true, true]);
  for (const name of ["Save vehicle", "Export garage"]) {
    const shape = await page.locator("#garage").getByRole("button", { name }).evaluate(element => {
      const style = getComputedStyle(element);
      return { radius: parseFloat(style.borderTopLeftRadius), height: element.getBoundingClientRect().height, font: style.fontFamily };
    });
    expect(shape.radius, name).toBeGreaterThanOrEqual(shape.height / 2);
    expect(shape.font, name).toContain("Geist");
  }
});

test("Pit Stop collections open on Instagram in a new tab and keep the app in place", async ({ page }) => {
  await openApp(page, true, "/pit-stop");
  const cards = page.locator("#pit-stop .pit-stop-card");
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    await expect(card).toHaveAttribute("target", "_blank");
    await expect(card).toHaveAttribute("rel", /noopener/);
    await expect(card).toHaveAttribute("href", /^https:\/\/www\.instagram\.com\//);
  }
});

test("a member can report a shared note and delete their own", async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  const reports: Record<string, unknown>[] = [];
  await page.route("https://example.supabase.co/rest/v1/**", async route => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split("/").pop();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type, prefer", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS", "content-type": "application/json" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers });
    if (table === "my_community_post_ids") return route.fulfill({ status: 200, headers, body: JSON.stringify(posts.map(post => post.id)) });
    if (table === "community_reports") {
      reports.push(request.postDataJSON());
      return route.fulfill({ status: 201, headers });
    }
    if (table === "community_posts") {
      if (request.method() === "POST") {
        const sent = request.postDataJSON();
        expect(Object.keys(sent)).not.toContain("createdAt");
        const row = { ...sent, id: "post-test-id", createdAt: "2026-10-07T00:00:00Z", status: "published" };
        posts.unshift(row);
        return route.fulfill({ status: 201, headers, body: JSON.stringify(row) });
      }
      if (request.method() === "DELETE") {
        const removed = posts.splice(0, posts.length).map(post => ({ id: post.id }));
        return route.fulfill({ status: 200, headers, body: JSON.stringify(removed) });
      }
      return route.fulfill({ status: 200, headers, body: JSON.stringify(posts) });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
  await openApp(page, true, "/community", true);
  await page.getByRole("link", { name: "Write an owner note" }).click();
  const composer = page.locator("#write");
  await composer.getByPlaceholder("Title", { exact: true }).fill("Brake pad cost");
  await composer.getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await composer.locator("textarea").fill("Front pads were replaced for 3200 rupees at 41,000 km.");
  await composer.getByRole("button", { name: "Publish owner note" }).click();
  const detail = page.locator("#note-detail");
  await expect(detail).toContainText("Brake pad cost");

  await detail.getByText("Report this note").click();
  await detail.getByPlaceholder("Tell us what is wrong with this note.").fill("  Wrong price quoted  ");
  await detail.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.locator(".action-message")).toHaveText("Report sent to moderators.");
  expect(reports).toEqual([{ post_id: "post-test-id", reason: "Wrong price quoted" }]);

  await page.reload();
  await page.locator("#feed .post-open").filter({ hasText: "Brake pad cost" }).click();
  page.once("dialog", dialog => dialog.accept());
  await detail.getByRole("button", { name: "Delete my note", exact: true }).click();
  await expect(page.locator(".action-message")).toHaveText("Note deleted.");
  await expect(page.locator("#feed")).not.toContainText("Brake pad cost");
});

test("real Clerk sign-in opens directly from navigation", async ({ page }) => {
  test.skip(process.env.OTOFOLKS_LIVE_AUTH !== "1", "Requires local Clerk configuration and network access");
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Sign in to/ })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("textbox", { name: /Email address/ })).toBeVisible();
  await page.screenshot({ path: "test-results/live-clerk-signin.png", fullPage: true });
});

test("comparison remains usable after adding cars and changing views", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openApp(page, true, "/compare");
  const sections = page.getByRole("region", { name: "Comparison categories" });
  await expect(sections.locator("summary > span:nth-child(2)")).toHaveText([
    "Basic Information", "Engine & Transmission", "Fuel & Performance", "Suspension, Steering & Brakes",
    "Dimensions & Capacity", "Comfort & Convenience", "Interior", "Exterior", "Safety", "ADAS",
    "Advanced Internet", "Entertainment & Communication",
  ]);
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await page.getByRole("combobox", { name: "Car brand", exact: true }).selectOption("Honda");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  const basics = page.getByRole("table", { name: "Basic Information comparison" });
  await expect(basics).toBeVisible();
  expect(await basics.getByRole("columnheader").last().evaluate(
    (cell) => cell.getBoundingClientRect().right <= window.innerWidth,
  )).toBe(true);
  await sections.locator("summary").filter({ hasText: "Dimensions & Capacity" }).click();
  await expect(page.getByRole("table", { name: "Dimensions & Capacity comparison" })).toContainText("Ground clearance");
  await sections.locator("summary").filter({ hasText: "Comfort & Convenience" }).click();
  await expect(page.getByRole("table", { name: "Comfort & Convenience comparison" })).toContainText("Climate control");
  await expect(page.getByRole("table", { name: "Comfort & Convenience comparison" })).toContainText("Not verified");
  await expect(page.getByText("We cannot recommend one from incomplete variant specs.", { exact: false })).toBeVisible();
  await expect(page.getByText("Lean towards", { exact: false })).toHaveCount(0);
  await expectNoOverflow(page);
  await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Find your next car" }).click();
  await expect(page.getByRole("table", { name: "Basic Information comparison" })).toBeVisible();
  // The categories opened before leaving are still open.
  await expect(page.getByRole("table", { name: "Dimensions & Capacity comparison" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Comfort & Convenience comparison" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Safety comparison" })).toBeHidden();
  await page.screenshot({ path: "test-results/comparison-populated-mobile.png", fullPage: true });
});

test("dealer quotes survive status changes and duplicate cars are rejected", async ({ page }) => {
  await openApp(page, true, "/compare");
  await page.getByRole("spinbutton", { name: "Dealer quote" }).fill("876543");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  const item = page.locator(".comparison-grid .comparison-card").first();
  await expect(item).toContainText("Your dealer quote");
  await item.locator("select").selectOption("Test drive");
  await page.reload();
  await expect(item).toContainText("8,76,543");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await expect(page.locator(".comparison-grid .comparison-card")).toHaveCount(1);
});

test("comparison keeps manufacturer facts tied to the chosen variants", async ({ page }) => {
  await openApp(page, true, "/compare");
  await page.getByRole("combobox", { name: "Car brand", exact: true }).selectOption("Honda");
  await page.getByRole("combobox", { name: "Car model", exact: true }).selectOption("Elevate");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await page.getByRole("combobox", { name: "Car brand", exact: true }).selectOption("Hyundai");
  await page.getByRole("combobox", { name: "Car model", exact: true }).selectOption("Creta");
  await page.getByRole("combobox", { name: "Variant", exact: true }).selectOption("EX Petrol MT");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  const sections = page.getByRole("region", { name: "Comparison categories" });
  await expect(page.getByRole("link", { name: "Honda India specifications" })).toHaveAttribute("href", /hondacarindia/);
  await expect(page.getByRole("link", { name: "Hyundai India specifications" })).toHaveAttribute("href", /hyundai/);
  await sections.locator("summary").filter({ hasText: "Fuel & Performance" }).click();
  await expect(page.getByRole("table", { name: "Fuel & Performance comparison" })).toContainText("15.31 km/l");
  await sections.locator("summary").filter({ hasText: "Safety" }).click();
  await expect(page.getByRole("table", { name: "Safety comparison" })).toContainText("6");
});
