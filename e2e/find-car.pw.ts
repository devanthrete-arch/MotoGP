import { expect, test } from "@playwright/test";
import { expectNoOverflow, openApp } from "./app";

for (const width of [390, 1440]) {
  test(`public car finder is usable at ${width}px and does not invent matches`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page, false, "/find-car");
    await expect(page).toHaveURL(/\/find-car$/);
    await expect(page.getByRole("heading", { name: "Find a car that fits your life" })).toBeVisible();
    await expect(page.getByLabel("State or territory")).toBeVisible();
    await expectNoOverflow(page);

    await page.getByLabel("State or territory").selectOption("Delhi");
    await page.getByLabel("Comfortable monthly service cost").selectOption("2000");
    await page.getByLabel("Petrol price (₹ per litre)").fill("96");
    const invalidFields = await page.locator(".find-car__form").evaluate(form =>
      [...(form as HTMLFormElement).elements].filter((field): field is HTMLInputElement | HTMLSelectElement =>
        field instanceof HTMLInputElement || field instanceof HTMLSelectElement).filter(field => !field.validity.valid)
        .map(field => ({ name: field.labels?.[0]?.textContent, value: field.value, message: field.validationMessage })));
    expect(invalidFields).toEqual([]);
    await page.getByRole("button", { name: "Show my matches" }).click();
    await expect(page.getByRole("heading", { name: "Recommendations aren’t ready yet" })).toBeVisible();
    await expect(page.getByText("We don’t yet have complete, verified car records with prices and ownership costs for your state, so we haven’t ranked any.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare cars" })).toHaveAttribute("href", "/compare");
    await expectNoOverflow(page);
  });
}

test("fuel rate label and unit follow the selected fuel", async ({ page }) => {
  await openApp(page, false, "/find-car");
  await page.getByLabel("Fuel preference").selectOption("CNG");
  await expect(page.getByLabel("CNG price (₹ per kg)")).toBeVisible();
  await page.getByLabel("Fuel preference").selectOption("Electric");
  await expect(page.getByLabel("Electricity price (₹ per unit)")).toBeVisible();
});

test("car finder collects a monthly service-cost preference", async ({ page }) => {
  await openApp(page, false, "/find-car");
  const serviceBudget = page.getByLabel("Comfortable monthly service cost");
  await expect(serviceBudget).toBeVisible();
  await expect(serviceBudget.locator("option")).toHaveText([
    "Choose a monthly amount",
    "₹1,000 or less",
    "₹2,000 or less",
    "₹4,000 or less",
    "No preference",
  ]);
  await serviceBudget.selectOption("2000");
});
