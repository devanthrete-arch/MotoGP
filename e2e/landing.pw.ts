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
const stored = (page: Page, area: "localStorage" | "sessionStorage", key: string) =>
  page.evaluate(([where, name]) => window[where as "localStorage"].getItem(name), [area, key]);
const accountKey = (name: string) => `autoflex.user.browser-test-user:autoflex.web.${name}.v1`;
const pendingPlate = "otofolks.pending-plate.v1";
const visitorShortlist = "otofolks.visitor-shortlist.v1";

for (const width of [320, 390, 768, 1440, 1920]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${width}px ${colorScheme}: landing page and what a visitor can open from it`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await openApp(page, false);
      const landing = page.locator(".landing");
      await expect(landing).toBeVisible();
      await expect(page.locator(".home-view")).toHaveCount(0);
      await expect(landing.getByRole("heading", { level: 1 })).toHaveText("Every car has a number. Start with yours.");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(landing.getByRole("textbox", { name: "Your registration number" })).toBeVisible();
      await expect(landing.getByRole("button", { name: "Add my vehicle" })).toBeVisible();
      await expect(landing.getByRole("link", { name: "Find my next car" })).toBeVisible();
      await expect(landing.getByRole("link", { name: "Read owner stories" })).toBeVisible();
      // The poster is immediate; the interactive model is only loaded after the visitor asks for it.
      await expect(landing.locator(".landing-stage__poster")).toBeVisible();
      await expect(landing.locator("canvas")).toHaveCount(0);
      await expectNoOverflow(page);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `test-results/landing-${width}-${colorScheme}.png`, fullPage: true });

      // Each link moves to its own address and shows that page's own heading.
      const navigation = width <= 860 ? page.locator(".tab-bar") : page.locator("#primary-nav-links");
      for (const [href, heading] of [["/garage", "Sign in to open My garage"], ["/community", "Owner notes are for signed-in members"],
        ["/pit-stop", "A break for your car obsession"], ["/compare", "Which car feels right?"]]) {
        await navigation.locator(`a[href='${href}']`).click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
        await expect(landing).toHaveCount(0);
        await expectNoOverflow(page);
        if (href === "/garage") await page.screenshot({ path: `test-results/prompt-${width}-${colorScheme}.png`, fullPage: true });
      }
    });
  }
}

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
    // With an error showing, and with a complete number (the lit stage).
    await page.getByRole("textbox", { name: "Your registration number" }).fill("MH12");
    await page.getByRole("button", { name: "Add my vehicle" }).click();
    expect(await violations(page, ".landing"), `${colorScheme} error`).toEqual([]);

    // axe will not judge text that sits under a large painted pseudo-element, which is exactly
    // what the stage's light and turntable are. So the stage is checked a second way: with both
    // taken away, hint and error are measured on the page ground they really sit on...
    const withoutStagePaint = await page.addStyleTag({ content: ".landing-stage::before, .landing-plate::before { content: none !important; }" });
    expect(await violations(page, ".landing-stage"), `${colorScheme} error text on the page ground`).toEqual([]);
    await page.getByRole("textbox", { name: "Your registration number" }).fill("KA 01 AB 1234");
    expect(await violations(page, ".landing-stage"), `${colorScheme} hint on the page ground`).toEqual([]);
    await withoutStagePaint.evaluate(style => style.remove());
    // ...and the label, the one text inside the light, is measured against the brightest ground it
    // can have: the lightest stop of the page, the light at full strength, then the turntable glass.
    const tones = await page.evaluate(() => {
      const probe = document.createElement("span");
      document.body.append(probe);
      const rgba = (colour: string) => {
        probe.style.color = colour;
        const [r, g, b, a = 1] = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? []).map(Number);
        return { rgb: [r, g, b], alpha: a };
      };
      const root = getComputedStyle(document.documentElement);
      const dark = root.colorScheme === "dark";
      const result = {
        label: rgba(getComputedStyle(document.querySelector(".landing-stage .ui-field__label")!).color).rgb,
        ground: rgba(root.getPropertyValue(dark ? "--slate-0" : "--ivory-0")).rgb,
        light: rgba(root.getPropertyValue("--stage-light")),
        // The glass fill is a gradient; its first stop is the most opaque white.
        glass: rgba(root.getPropertyValue("--glass-fill").match(/rgba?\([^)]*\)/)![0]),
      };
      probe.remove();
      return result;
    });
    const brightest = over(tones.glass.rgb, tones.glass.alpha, over(tones.light.rgb, tones.light.alpha, tones.ground));
    expect(contrast(tones.label, brightest), `${colorScheme} label on the lit turntable`).toBeGreaterThanOrEqual(4.5);

    expect(await violations(page, ".landing"), `${colorScheme} complete`).toEqual([]);
    await page.getByRole("button", { name: "Add my vehicle" }).click();
    await expect(page.locator(".owner-onboarding")).toBeVisible();
    expect(await violations(page, ".owner-onboarding"), `${colorScheme} owner setup`).toEqual([]);
    await page.evaluate(() => sessionStorage.clear());
  }
});

test("the two other ways in move within the app: Compare opens, owner stories ask for sign-in", async ({ page }) => {
  await openApp(page, false);
  await page.evaluate(() => { (window as unknown as { stillHere: boolean }).stillHere = true; });
  const stillHere = () => page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere === true);
  for (const name of ["Find my next car", "Read owner stories"]) {
    const shape = await page.getByRole("link", { name }).evaluate(element =>
      ({ radius: parseFloat(getComputedStyle(element).borderTopLeftRadius), height: element.getBoundingClientRect().height }));
    expect(shape.radius, name).toBeGreaterThanOrEqual(shape.height / 2);
  }

  await expect(page.getByRole("link", { name: "Find my next car" })).toHaveAttribute("href", "/compare");
  await page.getByRole("link", { name: "Find my next car" }).click();
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.getByRole("heading", { name: "Which car feels right?" })).toBeFocused();
  // A visitor's shortlist is not kept the way a member's is, and Compare says so.
  await expect(page.locator(".data-notice")).toHaveText("This shortlist lasts only as long as this tab. Sign in to keep it.");
  expect(await stillHere()).toBe(true);

  await page.goBack();
  await expect(page.getByRole("link", { name: "Read owner stories" })).toHaveAttribute("href", "/community");
  await page.getByRole("link", { name: "Read owner stories" }).click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(page.getByRole("heading", { name: "Owner notes are for signed-in members" })).toBeFocused();
  expect(await stillHere()).toBe(true);
  expect(await signInRequests(page)).toEqual([]);

  // The index further down the page leads to the same places, each row named by its area alone.
  await page.goBack();
  await expect(page.locator(".landing-item").getByRole("link")).toHaveText(["My garage", "Community", "Pit Stop", "Compare"]);
  await expect(page.locator(".landing-item small")).toHaveText(["Needs sign-in", "Needs sign-in", "Open to everyone", "Open to everyone"]);
  await page.locator(".landing-item", { hasText: "Pit Stop" }).click({ position: { x: 5, y: 5 } });
  await expect(page).toHaveURL(/\/pit-stop$/);
  await expect(page.locator("#pit-stop")).toBeVisible();
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

test("a number typed on the landing page reaches the add-vehicle form and never leaves the device", async ({ page }) => {
  const elsewhere: string[] = [];
  const carryingTheNumber: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).origin !== "http://localhost:8081") elsewhere.push(request.url());
    if (/MH\W*12\W*AB\W*1234/i.test(decodeURIComponent(request.url()) + (request.postData() ?? ""))) carryingTheNumber.push(request.url());
  });
  await openApp(page, false);
  const field = page.getByRole("textbox", { name: "Your registration number" });
  const go = page.getByRole("button", { name: "Add my vehicle" });
  const stage = page.locator(".landing-stage");
  const problem = page.locator(".landing .ui-field__error");

  // Without a number the owner path starts with catalogue selection.
  await expect(problem).toHaveCount(0);
  await go.click();
  await expect(page).toHaveURL("http://localhost:8081/owner/onboarding");
  await page.goto("/");
  // A number that is not finished still gets a clear validation message.
  await field.fill("MH12");
  await go.click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await field.pressSequentially("mh12");
  await field.press("Enter");
  await expect(problem).toContainText("Keep going");
  await field.fill("XX 12 AB 1234");
  await go.click();
  await expect(problem).toContainText("state code");
  await expect(page).toHaveURL(/\/$/);
  await expect(stage).not.toHaveAttribute("data-ready");
  expect(await stored(page, "sessionStorage", pendingPlate)).toBeNull();

  // A whole number, typed in lower case: the stage answers, and Enter carries it on.
  await field.fill("");
  await field.pressSequentially("mh12ab1234");
  await expect(field).toHaveValue("MH 12 AB 1234");
  await expect(problem).toHaveCount(0);
  await expect(stage).toHaveAttribute("data-ready", "");
  await expect(page.locator(".landing .ui-field__hint")).toHaveText("That looks like a complete number.");
  await field.press("Enter");
  await expect(page).toHaveURL("http://localhost:8081/owner/onboarding");
  expect(await stored(page, "sessionStorage", pendingPlate)).toBe("MH12AB1234");
  // The number remains in the manual add step and does not leave the site.
  const onboarding = page.locator(".owner-onboarding");
  await expect(onboarding.getByRole("textbox", { name: "Registration number (optional)" })).toHaveValue("MH 12 AB 1234");
  await page.goBack();
  await expect(field).toHaveValue("MH 12 AB 1234");
  // What the prompt promises is what the tab holds, whichever way the visitor got there. Here the
  // number is corrected and the visitor goes on by the navigation, without pressing Continue.
  await field.fill("");
  expect(await stored(page, "sessionStorage", pendingPlate)).toBeNull();
  await field.pressSequentially("mh12ab1235");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My garage" }).click();
  await expect(page.locator(".auth-gate")).toBeVisible();
  expect(await stored(page, "sessionStorage", pendingPlate)).toBe("MH12AB1235");
  // A number that is not whole is neither promised nor kept.
  await page.goBack();
  await field.fill("MH 12 AB 123");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My garage" }).click();
  await expect(page.locator(".auth-gate")).toBeVisible();
  expect(await stored(page, "sessionStorage", pendingPlate)).toBeNull();
  await page.goBack();
  await field.fill("MH 12 AB 1234");
  await expect(field).toHaveValue("MH 12 AB 1234");
  await field.press("Enter");
  await expect(page).toHaveURL("http://localhost:8081/owner/onboarding");
  await expect(onboarding.getByRole("textbox", { name: "Registration number (optional)" })).toHaveValue("MH 12 AB 1234");

  // It belongs to this tab: another tab of the same browser does not have it.
  const otherTab = await page.context().newPage();
  await openApp(otherTab, true, "/garage");
  await expect(otherTab.locator("#garage").getByRole("textbox", { name: "Registration number (optional)" })).toHaveValue("");
  await otherTab.close();

  // Signing in ends with a page load at the address the prompt was on. The number is in the form.
  await openApp(page, true, "/garage");
  const garage = page.locator("#garage");
  const plate = garage.getByRole("textbox", { name: "Registration number (optional)" });
  await expect(plate).toHaveValue("MH 12 AB 1234");
  await page.screenshot({ path: "test-results/garage-carried-number.png" });
  await garage.locator("form").nth(0).getByPlaceholder("Model", { exact: true }).fill("Nexon");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  const cards = garage.locator(".timeline-board .vehicle-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("MH 12 AB 1234");
  await expect(cards.first()).toContainText("number kept on this device only");
  // Used once: the next vehicle starts with an empty field, here and after a reload.
  await expect(plate).toHaveValue("");
  expect(await stored(page, "sessionStorage", pendingPlate)).toBeNull();

  // The number is kept beside the garage, under this account, and is not part of a vehicle.
  const garageRows = JSON.parse((await stored(page, "localStorage", accountKey("garage")))!) as Record<string, unknown>[];
  expect(Object.keys(garageRows[0]).sort()).toEqual(["brand", "city", "id", "kind", "model", "nickname", "odometerKm", "purchaseMonth", "source", "variant"]);
  expect(JSON.parse((await stored(page, "localStorage", accountKey("vehicle-plates")))!)).toEqual({ [garageRows[0].id as string]: "MH12AB1234" });
  expect(await stored(page, "localStorage", "autoflex.web.vehicle-plates.v1")).toBeNull();
  await page.reload();
  await expect(cards.first()).toContainText("MH 12 AB 1234");
  await expect(plate).toHaveValue("");

  // In the form the number is optional. Passing through the empty field, or having just saved a
  // vehicle, does not make the next number an error from its first character...
  const plateProblem = garage.locator(".ui-field__error");
  await plate.focus();
  await garage.locator("form").nth(0).getByPlaceholder("Model", { exact: true }).fill("Punch");
  await plate.pressSequentially("MH 12");
  await expect(plateProblem).toHaveCount(0);
  // ...but one that is started must be finished or cleared: saving says so and goes to the field.
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  await expect(plateProblem).toContainText("Keep going");
  await expect(plate).toBeFocused();
  await expect(page.locator(".action-message")).toHaveText("Finish the registration number, or clear it, then save again.");
  await expect(cards).toHaveCount(1);
  await plate.fill("");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Punch");
  await expect(cards.first()).not.toContainText("on this device only");
  await plate.pressSequentially("KA");
  await expect(plateProblem).toHaveCount(0);
  await plate.fill("");

  // Signing out, by whatever route, empties what the tab holds: the next person does not find
  // the last one's number on the landing page or in their own add-vehicle form.
  await plate.fill("DL 3C AB 1234");
  expect(await stored(page, "sessionStorage", pendingPlate)).toBe("DL3CAB1234");
  await openApp(page, false);
  await expect(field).toHaveValue("");
  await expect(stage).not.toHaveAttribute("data-ready");
  expect(await stored(page, "sessionStorage", pendingPlate)).toBeNull();
  // The same when the tab goes straight from one account to another.
  await openApp(page, true, "/garage");
  await plate.fill("DL 3C AB 1234");
  await openApp(page, true, "/garage", false, { userId: "someone-else" });
  await expect(plate).toHaveValue("");
  await expect(garage.locator(".timeline-board .vehicle-card")).toHaveCount(0);
  expect(await stored(page, "sessionStorage", pendingPlate)).toBeNull();

  expect(elsewhere).toEqual([]);
  expect(carryingTheNumber).toEqual([]);
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
  await expect(garage.locator(".timeline-board .vehicle-card").first()).toContainText("DL 3 CAB 1234");

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Account" }).click();
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
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My garage" }).click();
  await garage.getByRole("textbox", { name: "Registration number (optional)" }).fill("KA 01 AB 1234");
  await garage.locator("form").nth(0).getByPlaceholder("Model", { exact: true }).fill("Seltos");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  await expect(garage.locator(".timeline-board .vehicle-card")).toHaveCount(2);
  expect(Object.values(JSON.parse((await stored(page, "localStorage", accountKey("vehicle-plates")))!)).sort()).toEqual(["DL3CAB1234", "KA01AB1234"]);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Account" }).click();
  page.once("dialog", dialog => dialog.accept());
  await account.getByRole("button", { name: "Restore from account", exact: true }).click();
  await expect(account.getByRole("status")).toHaveText("Account copy restored to this device.");
  expect(JSON.parse((await stored(page, "localStorage", accountKey("vehicle-plates")))!)).toEqual({ [vehicle.id as string]: "DL3CAB1234" });
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My garage" }).click();
  await expect(garage.locator(".timeline-board .vehicle-card")).toHaveCount(1);
  await expect(garage.locator(".timeline-board .vehicle-card")).toContainText("DL 3 CAB 1234");
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
  await expect(cards.locator(".inspection-item")).toHaveCount(2);
  await expect(cards.locator(".inspection-item b")).toHaveText(["Start with a baseline inspection checklist", "Start with a baseline inspection checklist"]);
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
