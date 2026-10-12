import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoOverflow, openApp, pageErrors, signInRequests } from "./app";

// The public landing page, what a visitor can open from it, and what survives a sign-in.
test.afterEach(({ page }) => { expect(pageErrors(page)).toEqual([]); });

const violations = async (page: Page, include: string) => {
  const results = await new AxeBuilder({ page }).include(include)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(" ")).join(", ")}`);
};
// A link to one of the app's views, in the header.
const appLink = (page: Page, name: string) => page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name });
const stored = (page: Page, area: "localStorage" | "sessionStorage", key: string) =>
  page.evaluate(([where, name]) => window[where as "localStorage"].getItem(name), [area, key]);
const accountKey = (name: string) => `autoflex.user.browser-test-user:autoflex.web.${name}.v1`;
const pendingPlate = "otofolks.pending-plate.v1";
const visitorShortlist = "otofolks.visitor-shortlist.v1";

for (const width of [320, 390, 768, 1440, 1920]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${width}px ${colorScheme}: landing page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await openApp(page, false);
      const landing = page.locator(".landing");
      await expect(landing).toBeVisible();
      await expect(page.locator(".home-view")).toHaveCount(0);
      await expect(landing.getByRole("heading", { level: 1 })).toHaveText("Make it real");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(landing.getByRole("link", { name: "Join Community" })).toHaveAttribute("href", "/community");
      await expect(landing.getByRole("button", { name: "Scroll down" })).toBeVisible();
      // No navigation bar, no demo button, no tagline, and nothing below the strip of studios.
      await expect(landing.getByRole("link", { name: "Try It Out" })).toHaveCount(0);
      await expect(landing.getByRole("button", { name: "Book a Demo" })).toHaveCount(0);
      await expect(landing.getByText("A new way to know your vehicle")).toHaveCount(0);
      await expect(landing.locator(".lp-toolkit, .lp-start, .lp-foot, .lp-nav")).toHaveCount(0);
      // The studio and the concept on its display are immediate; the flat studio draws no canvas.
      await expect(landing.locator(".lp-hero")).toBeVisible();
      await expect(landing.locator(".lp-screen img.lp-pair__r")).toBeAttached();
      await expect(landing.locator("canvas")).toHaveCount(0);
      await expectNoOverflow(page);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `test-results/landing-${width}-${colorScheme}.png`, fullPage: true });

      // Join Community goes to Community, which asks a visitor to sign in before showing anything.
      await landing.getByRole("link", { name: "Join Community" }).click();
      await expect(page).toHaveURL(/\/community$/);
      await expect(page.getByRole("heading", { name: "Owner notes are for signed-in members" })).toBeVisible();
      await expect(landing).toHaveCount(0);
      await expectNoOverflow(page);
    });
  }
}

test("scrolling through the whole hero opens sign-in; jumping past it does not", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page, false);
  await page.mouse.move(640, 400);
  expect(await signInRequests(page)).toEqual([]);
  for (let step = 0; step < 40 && (await signInRequests(page)).length === 0; step++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(60); }
  await expect.poll(() => signInRequests(page)).toEqual(["/ sign-in"]);
  // A link or a restored scroll position lands past the hero without asking anything.
  await openApp(page, false);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  expect(await signInRequests(page)).toEqual([]);
});

test("members get Home and visitors the landing page; an unknown address goes to it", async ({ page }) => {
  await openApp(page, true);
  await expect(page.locator(".home-view")).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
  await openApp(page, false, "/no-such-page");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".landing")).toBeVisible();
  await expect(page.locator(".home-view")).toHaveCount(0);
});

// Relative luminance contrast between two colours given as [r, g, b].
const contrast = (first: number[], second: number[]) => {
  const luminance = (colour: number[]) => {
    const [r, g, b] = colour.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};
// One colour laid over another at the given opacity.
const over = (top: number[], alpha: number, ground: number[]) => ground.map((value, index) => top[index] * alpha + value * (1 - alpha));

test("the landing page and the sign-in prompt pass accessibility checks in both themes", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await openApp(page, false);
    await page.evaluate(() => document.fonts.ready);
    expect(await violations(page, ".landing"), colorScheme).toEqual([]);
    await page.goto("/garage");
    await expect(page.locator(".auth-gate")).toBeVisible();
    expect(await violations(page, ".auth-gate"), `${colorScheme} sign-in prompt`).toEqual([]);
  }
});

test("the car finder stays public and leads to Compare", async ({ page }) => {
  await openApp(page, false, "/find-car");
  await page.evaluate(() => { (window as unknown as { stillHere: boolean }).stillHere = true; });
  const stillHere = () => page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere === true);
  await expect(page.getByRole("heading", { name: "Find a car that fits your life" })).toBeVisible();
  await page.getByLabel("State or territory").selectOption("Delhi");
  await page.getByLabel("Petrol price (₹ per litre)").fill("96");
  await page.getByRole("button", { name: "Show my matches" }).click();
  await expect(page.getByRole("heading", { name: "Recommendations aren’t ready yet" })).toBeVisible();
  await page.getByRole("link", { name: "Compare cars" }).click();
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.getByRole("heading", { name: "Compare vehicles" })).toBeVisible();
  await expect(page.locator(".compare-builder")).toBeVisible();
  expect(await stillHere()).toBe(true);
  expect(await signInRequests(page)).toEqual([]);
});

test("old fragment links take a visitor to the prompt or the open view, never by way of the landing page", async ({ page }) => {
  await page.addInitScript(() => {
    const seen = window as unknown as { sawLanding: boolean };
    seen.sawLanding = false;
    new MutationObserver(() => { if (document.querySelector(".landing")) seen.sawLanding = true; })
      .observe(document, { childList: true, subtree: true });
  });
  const sawLanding = () => page.evaluate(() => (window as unknown as { sawLanding: boolean }).sawLanding);
  await openApp(page, false, "/#garage");
  await expect(page).toHaveURL(/\/garage$/);
  await expect(page.locator(".auth-gate")).toBeVisible();
  expect(await sawLanding()).toBe(false);
  await page.goto("/account");
  await page.goto("/#compare");
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.locator("#compare")).toBeVisible();
  expect(await sawLanding()).toBe(false);
});

test("saving to the account uploads the vehicle without its registration number", async ({ page }) => {
  const uploads: string[] = [];
  await page.route("https://example.supabase.co/rest/v1/**", async route => {
    const request = route.request();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "apikey, authorization, content-type, prefer", "content-type": "application/json" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers });
    if (request.url().includes("save_otofolks_private_workspace")) {
      uploads.push(request.postData() ?? "");
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ user_id: "browser-test-user",
        payload: request.postDataJSON().p_payload, revision: 1, updated_at: "2026-10-08T00:00:00Z" }) });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
  await openApp(page, true, "/garage", true);
  const garage = page.locator("#garage");
  await garage.getByRole("textbox", { name: "Registration number (optional)" }).fill("dl 3c ab 1234");
  await garage.locator("form").nth(0).getByPlaceholder("Model", { exact: true }).fill("Creta");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  await expect(garage.locator(".garage-vehicle-list .vehicle-card").first()).toContainText("DL 3 CAB 1234");

  await appLink(page, "Account").click();
  const account = page.locator("#account");
  await expect(account).toContainText("Community drafts and registration numbers stay on this device.");
  await account.getByRole("button", { name: "Save to account", exact: true }).click();
  await expect(account.getByRole("status")).toHaveText("Saved to your account.");
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).not.toMatch(/DL\W*3\W*C\W*AB\W*1234/i);
  const [vehicle] = JSON.parse(uploads[0]).p_payload.garage as Record<string, unknown>[];
  expect(Object.keys(vehicle).sort()).toEqual(["brand", "city", "id", "kind", "model", "nickname", "odometerKm", "purchaseMonth", "source", "variant"]);
  expect(vehicle.model).toBe("Creta");

  // A second vehicle is added with a number, then the garage is restored from the account copy,
  // which has only the first. The first keeps its number; the removed vehicle's number goes with it.
  await appLink(page, "My garage").click();
  await garage.getByRole("textbox", { name: "Registration number (optional)" }).fill("KA 01 AB 1234");
  await garage.locator("form").nth(0).getByPlaceholder("Model", { exact: true }).fill("Seltos");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  await expect(garage.locator(".garage-vehicle-list .vehicle-card")).toHaveCount(2);
  expect(Object.values(JSON.parse((await stored(page, "localStorage", accountKey("vehicle-plates")))!)).sort()).toEqual(["DL3CAB1234", "KA01AB1234"]);
  await appLink(page, "Account").click();
  page.once("dialog", dialog => dialog.accept());
  await account.getByRole("button", { name: "Restore from account", exact: true }).click();
  await expect(account.getByRole("status")).toHaveText("Account copy restored to this device.");
  expect(JSON.parse((await stored(page, "localStorage", accountKey("vehicle-plates")))!)).toEqual({ [vehicle.id as string]: "DL3CAB1234" });
  await appLink(page, "My garage").click();
  await expect(garage.locator(".garage-vehicle-list .vehicle-card")).toHaveCount(1);
  await expect(garage.locator(".garage-vehicle-list .vehicle-card")).toContainText("DL 3 CAB 1234");
});

test("the number fits the add-vehicle form on the narrowest phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openApp(page, true, "/garage");
  const plate = page.locator("#garage").getByRole("textbox", { name: "Registration number (optional)" });
  // The longest number there is: two letters, two digits, three letters, four digits.
  await plate.fill("MH 12 ABC 1234");
  await page.evaluate(() => document.fonts.ready);
  await plate.blur();
  expect(await plate.evaluate((input: HTMLInputElement) => input.scrollWidth <= input.clientWidth)).toBe(true);
  expect(await plate.evaluate(input => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
  await expectNoOverflow(page);
});

test("a shortlist built before signing in comes along once, and nothing else in the browser does", async ({ page }) => {
  const supabase: string[] = [];
  await page.route("https://example.supabase.co/**", route => { supabase.push(route.request().url()); return route.abort(); });
  // Something an earlier user of this browser left in the shared, signed-out storage.
  await openApp(page, false, "/compare", true);
  await page.evaluate(() => {
    localStorage.setItem("autoflex.web.shortlist.v1", JSON.stringify([
      { id: "left-behind", brand: "Maruti Suzuki", model: "Swift", budget: 650000, status: "New", notes: "someone else's quote" }]));
    // And a note about the very car the visitor is about to shortlist.
    localStorage.setItem("autoflex.web.posts.v1", JSON.stringify([{ id: "left-behind-note", brand: "Tata", model: "Nexon",
      variant: "XZ", title: "Left behind by an earlier user", label: "Known issue", topic: "Repairs", city: "Pune",
      odometerKm: 61000, body: "A note stored in this browser before accounts existed.", author: "Earlier user",
      createdAt: "2026-01-01T00:00:00.000Z", helpful: 0, fixesConfirmed: 0, comments: [] }]));
  });
  await page.reload();
  const cards = page.locator(".comparison-grid .comparison-card");
  await expect(page.locator("#compare")).toBeVisible();
  await expect(cards).toHaveCount(0);

  // The visitor shortlists two cars. They are kept in the tab.
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await page.getByRole("combobox", { name: "Car brand", exact: true }).selectOption("Honda");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole("table", { name: "Basic Information comparison" })).toBeVisible();
  // No owner note is quoted to a visitor: neither the bundled examples nor the one left in this
  // browser. Each car's checklist is the plain starting one.
  await expect(cards.locator(".compare-inspection")).toHaveCount(2);
  await expect(cards.locator(".compare-inspection p")).toHaveText(["Start with a baseline inspection checklist", "Start with a baseline inspection checklist"]);
  for (const quoted of ["Left behind by an earlier user", "Community notes reach", "Nexon diesel clutch", "Owner note"]) {
    await expect(page.locator("#compare")).not.toContainText(quoted);
  }
  expect(JSON.parse((await stored(page, "sessionStorage", visitorShortlist))!)).toHaveLength(2);
  expect(JSON.parse((await stored(page, "localStorage", "autoflex.web.shortlist.v1"))!)).toHaveLength(1);
  // A visitor, even with a cloud connection configured, sends nothing to the database.
  expect(supabase).toEqual([]);

  // Sign in in the same tab: both cars are now the account's, the tab's copy is gone, the stray one is not picked up.
  await openApp(page, true, "/compare");
  await expect(cards).toHaveCount(2);
  await expect(page.locator("#compare")).not.toContainText("Swift");
  // A member's Compare does draw on owner notes (their own device's, here the bundled examples),
  // which is what the visitor's did not.
  await expect(page.locator("#compare")).toContainText("Verify common fix history");
  await expect(page.locator("#compare")).not.toContainText("Left behind by an earlier user");
  expect(await stored(page, "sessionStorage", visitorShortlist)).toBeNull();
  const firstCarry = JSON.parse((await stored(page, "localStorage", accountKey("shortlist")))!) as { id: string; brand: string }[];
  expect(firstCarry.map(item => item.brand)).toEqual(["Honda", "Tata"]);
  // Reloading does not bring them in again.
  await page.reload();
  await expect(cards).toHaveCount(2);

  // Signed out again the tab starts empty. One car the account already has and one new car are shortlisted.
  await openApp(page, false, "/compare");
  await expect(cards).toHaveCount(0);
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await page.getByRole("combobox", { name: "Car brand", exact: true }).selectOption("Hyundai");
  await page.getByRole("button", { name: "Add to compare", exact: true }).click();
  await expect(cards).toHaveCount(2);
  // Signing in adds only the new one, in front, and every car keeps an id of its own.
  await openApp(page, true, "/compare");
  await expect(cards).toHaveCount(3);
  const merged = JSON.parse((await stored(page, "localStorage", accountKey("shortlist")))!) as { id: string; brand: string }[];
  expect(merged.map(item => item.brand)).toEqual(["Hyundai", "Honda", "Tata"]);
  expect(new Set(merged.map(item => item.id)).size).toBe(3);

  // Another account on this device, in this same tab, gets none of it.
  await openApp(page, true, "/compare", false, { userId: "someone-else" });
  await expect(page.locator("#compare")).toBeVisible();
  await expect(cards).toHaveCount(0);
});
