import { expect, test } from "@playwright/test";
import { openApp } from "./app";

test("garage vehicles can be edited and deleted with their local maintenance history", async ({ page }) => {
  await openApp(page, true, "/garage");
  const garage = page.locator("#garage");
  const addForm = garage.locator("form").nth(0);
  await addForm.getByLabel("Nickname").fill("Family car");
  await addForm.getByLabel("Model").fill("Nexon");
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  const vehicle = garage.locator(".vehicle-card").filter({ hasText: "Family car" });
  await vehicle.getByRole("button", { name: "Edit vehicle" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit vehicle" });
  await dialog.getByLabel("Nickname").fill("Family Nexon");
  await dialog.getByLabel("Colour").fill("White");
  await dialog.getByLabel("Manufacture year").fill("2022");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(garage.locator(".vehicle-card")).toContainText("Family Nexon");
  await expect(garage.locator(".vehicle-card")).toContainText("White");
  await garage.locator("form").nth(1).getByLabel("What happened?").fill("Oil changed");
  await garage.getByRole("button", { name: "Add timeline note" }).click();
  await garage.locator(".vehicle-card").filter({ hasText: "Family Nexon" }).getByRole("button", { name: "Delete vehicle" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete vehicle" });
  await expect(confirm).toContainText("Maintenance history for this vehicle will also be deleted.");
  await confirm.getByRole("button", { name: "Delete vehicle", exact: true }).click();
  await expect(garage.locator(".vehicle-card")).toHaveCount(0);
  await expect(garage.locator(".timeline-board")).not.toContainText("Oil changed");
});

test("a recorded PUC expiry appears in garage reminders", async ({ page }) => {
  await openApp(page, true, "/garage");
  const garage = page.locator("#garage");
  const addForm = garage.locator("form").nth(0);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 10);
  const expiryDate = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}-${String(expiry.getDate()).padStart(2, "0")}`;
  await addForm.getByLabel("Nickname").fill("Daily car");
  await addForm.getByLabel("Model").fill("Nexon");
  await addForm.getByLabel("PUC expiry date (optional)").fill(expiryDate);
  await garage.getByRole("button", { name: "Save vehicle" }).click();
  await expect(garage.locator("#garage-reminders")).toContainText("Check your PUC certificate");
  await expect(garage.locator("#garage-reminders")).toContainText("expires in 10 days");
});
