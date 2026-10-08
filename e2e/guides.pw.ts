import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectNoOverflow, openApp } from "./app";

for (const viewport of [
  { width: 390, height: 844, mode: "light" as const },
  { width: 1440, height: 900, mode: "dark" as const },
]) {
  test(`care guides are readable without sign-in at ${viewport.width}px ${viewport.mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: viewport.mode });
    await openApp(page, false, "/guides");
    const guide = page.locator(".guide-page");
    await expect(guide.getByRole("heading", { level: 1, name: "Care guides" })).toBeVisible();
    await expect(guide.getByRole("link", { name: /Make the next service easier/ })).toBeVisible();
    expect((await new AxeBuilder({ page }).include(".guide-page").analyze()).violations).toEqual([]);
    await expectNoOverflow(page);

    await guide.getByRole("link", { name: /Make the next service easier/ }).click();
    await expect(page).toHaveURL(/\/guides\/service-records$/);
    await expect(guide.getByRole("heading", { level: 1, name: "Make the next service easier to plan" })).toBeVisible();
    await expect(guide).toContainText("owner's manual");
    await expect(guide.getByRole("link", { name: /service calculator/ })).toHaveAttribute("href", /^https:\/\//);
    await expect(guide.getByRole("link", { name: "Compare cars" })).toHaveAttribute("href", "/compare");
    expect((await new AxeBuilder({ page }).include(".guide-page").analyze()).violations).toEqual([]);
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`guide-${viewport.width}-${viewport.mode}.png`), fullPage: true });
  });
}
