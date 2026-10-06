import { expect, test, type Page } from "@playwright/test";

// Exercise the app's auth boundary without depending on a live Clerk account.
async function openApp(page: Page, signedIn: boolean, hash = "") {
  page.on("pageerror", error => console.error(error.message));
  await page.route("**/src/main.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: `import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import { OtofolksApp } from '/src/App.tsx';
      import '/src/styles.css';
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(OtofolksApp, {
        auth: { userId: 'browser-test-user', isLoaded: true, isSignedIn: ${signedIn}, requireSignIn: () => { window.signInRequested = true; } }
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

test("owner note, comments and filters work without stale detail", async ({ page }) => {
  await openApp(page, true, "#feed");
  await page.getByRole("link", { name: "Write an owner note" }).click();
  const composer = page.locator("#write");
  await composer.getByPlaceholder("Title", { exact: true }).fill("My service visit");
  await composer.getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await composer.locator("textarea").fill("The oil change cost 4200 rupees and resolved the noise.");
  await composer.getByRole("button", { name: "Save owner note" }).click();
  await expect(page.locator("#feed")).toBeVisible();
  await expect(page.locator("#note-detail")).toContainText("My service visit");
  await page.locator("#note-detail .inline-form").first().locator("textarea").fill("Keep the invoice.");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page.reload();
  await expect(page.locator("#note-detail")).toContainText("Keep the invoice.");
  await page.getByPlaceholder("Search brand, model, city, issue...").fill("no-matching-vehicle-ever");
  await expect(page.locator("#note-detail")).not.toContainText("My service visit");
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
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await page.getByRole("combobox", { name: "Car brand", exact: true }).selectOption("Honda");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await expect(page.getByRole("table", { name: "Compared metrics" })).toBeVisible();
  const category = page.getByRole("combobox", { name: "Comparison category" });
  await expect(category.locator("option")).toHaveText([
    "Basic Information", "Engine & Transmission", "Fuel & Performance", "Suspension, Steering & Brakes",
    "Dimensions & Capacity", "Comfort & Convenience", "Interior", "Exterior", "Safety", "ADAS",
    "Advanced Internet", "Entertainment & Communication",
  ]);
  await category.selectOption("Dimensions & Capacity");
  await expect(page.getByRole("table", { name: "Compared metrics" })).toContainText("Body type");
  await category.selectOption("Comfort & Convenience");
  await expect(page.getByText("Details for this category are not available yet.")).toBeVisible();
  await expectNoOverflow(page);
  await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Find your next car" }).click();
  await expect(page.getByRole("table", { name: "Compared metrics" })).toBeVisible();
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
