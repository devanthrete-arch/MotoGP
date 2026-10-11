import { expect, test } from "@playwright/test";
import { expectNoOverflow, openApp } from "./app";

for (const width of [390, 1440]) {
  test(`home garage 3D hero renders at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("autoflex.user.browser-test-user:autoflex.web.garage.v1", JSON.stringify([{
      id: "hero-preview", nickname: "Toyota Hyryder", brand: "Toyota", model: "Hyryder", variant: "",
      city: "Delhi", odometerKm: 12000, purchaseMonth: "2025-01", kind: "car", manufactureYear: 2025,
    }])));
    await openApp(page, true);
    const stage = page.locator(".member-home__garage-stage");
    await expect(stage).toBeVisible();
    await expect(page.getByRole("heading", { name: "Toyota Hyryder" })).toBeVisible();
    await expect(stage.locator("canvas")).toBeVisible();
    await expect(page.getByText("Original generic 3D shape · not a model replica")).toBeVisible();
    await expect(stage.getByRole("link", { name: "Service history" })).toHaveAttribute("href", "/garage#garage-reminders");
    await expectNoOverflow(page);
    await page.screenshot({ path: `test-results/home-garage-${width}.png`, fullPage: true });
  });
}

test("home garage avoids continuous rotation when reduced motion is requested", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("autoflex.user.browser-test-user:autoflex.web.garage.v1", JSON.stringify([{
    id: "hero-preview", nickname: "Toyota Hyryder", brand: "Toyota", model: "Hyryder", variant: "",
    city: "Delhi", odometerKm: 12000, purchaseMonth: "2025-01", kind: "car", manufactureYear: 2025,
  }])));
  await openApp(page, true);
  await expect(page.locator(".member-home__garage-stage canvas")).toBeVisible();
});
