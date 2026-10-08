import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("owner setup offers catalogue and manual two-wheeler paths without leaving the app", async ({ page }) => {
  await page.goto("/owner/onboarding");
  await expect(page.getByRole("heading", { name: "Add your vehicle" })).toBeVisible();
  expect((await new AxeBuilder({ page }).include(".owner-onboarding").analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Car", exact: true }).click();
  await page.getByLabel("Make").selectOption({ label: "Tata" });
  await expect(page.getByLabel("Model")).toHaveValue("Nexon");
  await expect(page.getByLabel("Variant")).toHaveValue("Smart Petrol MT");
  await page.getByRole("button", { name: "My vehicle is not listed" }).click();
  await page.getByLabel("Make").fill("Honda");
  await page.getByLabel("Model").fill("City");
  await page.getByRole("button", { name: "Two-wheeler", exact: true }).click();
  await expect(page.getByText("Two-wheeler catalogue is coming later.")).toBeVisible();
  expect((await new AxeBuilder({ page }).include(".owner-onboarding").analyze()).violations).toEqual([]);
  await page.getByLabel("Make").fill("Honda");
  await page.getByLabel("Model").fill("Activa 6G");
  await page.getByLabel("Manufacture year (optional)").fill("2022");
  await page.reload();
  await expect(page.getByRole("button", { name: "Two-wheeler", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Model")).toHaveValue("Activa 6G");
  await expect(page.getByLabel("Manufacture year (optional)")).toHaveValue("2022");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
