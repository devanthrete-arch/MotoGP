import { expect, test } from "@playwright/test";
import { openApp } from "./app";

test("review composer asks for model-specific positives, trade-offs and a buy-again verdict", async ({ page }) => {
  await openApp(page, true, "/community");
  await page.getByRole("button", { name: /Share advice with the community/ }).click();
  await page.locator(".composer-expanded select").first().selectOption("Review");
  await expect(page.getByRole("group", { name: "Help another owner understand life with this car" })).toBeVisible();
  await expect(page.getByLabel("What has worked well?")).toHaveAttribute("required", "");
  await expect(page.getByLabel("What should a buyer know or watch for?")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Would you choose it again?")).toHaveAttribute("required", "");
  await expect(page.getByPlaceholder("Model", { exact: true })).toHaveAttribute("required", "");
  await page.locator(".composer-expanded select").first().selectOption("Owner note");
  await expect(page.getByRole("group", { name: "Help another owner understand life with this car" })).toHaveCount(0);
});
