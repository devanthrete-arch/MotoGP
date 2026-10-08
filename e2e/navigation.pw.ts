import { expect, test, type Page } from "@playwright/test";

// Exercise the app's auth boundary without depending on a live Clerk account.
async function openApp(page: Page, signedIn: boolean, hash = "", cloud = false) {
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
  await page.goto(`/${hash}`);
  await expect(page.getByRole("navigation", {
    name: (page.viewportSize()?.width ?? 1440) <= 860 ? "Primary" : "Primary navigation",
    exact: true,
  })).toBeVisible();
}

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
      for (const id of ["garage", "feed", "pit-stop", "compare"]) {
        const navigation = width <= 860 ? page.locator(".tab-bar") : page.locator("#primary-nav-links");
        await navigation.locator(`a[href='#${id}']`).click();
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
  await tabs.locator("a[href='#feed']").click();
  await expect(tabs.locator("a[href='#feed']")).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(tabs).toBeVisible();
});

test("signed-out actions request login and never reveal feature data", async ({ page }) => {
  await openApp(page, false);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { signInRequested: boolean }).signInRequested)).toBe(true);
  await page.getByRole("link", { name: "Ask the community" }).click();
  expect(await page.evaluate(() => (window as unknown as { signInRequested: boolean }).signInRequested)).toBe(true);
  await expect(page.locator("#feed")).toHaveCount(0);
  await page.goto("/#compare");
  await expect(page.locator("#compare")).toHaveCount(0);
});

test("vehicle and maintenance records survive reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, true, "#garage");
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
  await openApp(page, true, "#feed");
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
  await openApp(page, true, "#feed", true);
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
  await openApp(page, true, "#garage");
  const garage = page.locator("#garage");
  await garage.getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  const toast = page.locator(".action-message");
  await expect(toast).toHaveText("Vehicle saved on this device.");
  const tabs = page.getByRole("navigation", { name: "Primary", exact: true });
  const toastBox = await toast.boundingBox();
  const tabsBox = await tabs.boundingBox();
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(tabsBox!.y);
  await tabs.locator("a[href='#compare']").click();
  await expect(tabs.locator("a[href='#compare']")).toHaveAttribute("aria-current", "page");
  await expect(toast).toHaveCount(0, { timeout: 8000 });
});

test("Pit Stop collections open on Instagram in a new tab and keep the app in place", async ({ page }) => {
  await openApp(page, true, "#pit-stop");
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
  await openApp(page, true, "#feed", true);
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
  await openApp(page, true, "#compare");
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
  await page.screenshot({ path: "test-results/comparison-populated-mobile.png", fullPage: true });
});

test("dealer quotes survive status changes and duplicate cars are rejected", async ({ page }) => {
  await openApp(page, true, "#compare");
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
  await openApp(page, true, "#compare");
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
