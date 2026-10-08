import { expect, test, type Page } from "@playwright/test";

const payload = { version: 2, profile: { displayName: "Cloud owner", city: "Delhi", garageRole: "Owner" },
  garage: [], timeline: [], shortlist: [], follows: { models: [], topics: [] }, saved: ["advice"] };
const row = { user_id: "user_A", payload, revision: 2, updated_at: "2026-10-05T10:00:00Z" };

async function openPanel(page: Page) {
  await page.route("**/src/main.tsx*", route => route.fulfill({ contentType: "application/javascript", body: `
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import { CloudWorkspacePanel } from '/src/CloudWorkspacePanel.tsx';
    import { createClerkSupabaseClient } from '/src/supabase.ts';
    import '/src/styles.css';
    const root=ReactDOM.createRoot(document.getElementById('root'));
    const client=createClerkSupabaseClient({url:'https://workspace-fixture.supabase.co',publishableKey:'sb_publishable_fixture'},async()=> 'fixture-token');
    window.showOwner=(owner)=>root.render(React.createElement(CloudWorkspacePanel,{key:owner,client,owner,workspace:${JSON.stringify(payload)},onRestore:data=>{window.restored=data}}));
    window.showOwner('user_A');
  ` }));
  await page.goto("/");
}

test("cloud reads never upload; restore needs confirmation; narrow phone layout fits", async ({ page }) => {
  let writes = 0;
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route("https://workspace-fixture.supabase.co/**", route => {
    if (route.request().method() === "POST") writes++;
    return route.fulfill({ json: [row] });
  });
  await openPanel(page);
  await expect(page.getByRole("button", { name: "Save to account", exact: true })).toBeEnabled();
  expect(writes).toBe(0);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Restore from account", exact: true }).click();
  expect(await page.evaluate(() => (window as any).restored)).toBeUndefined();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Restore from account", exact: true }).click();
  expect(await page.evaluate(() => (window as any).restored)).toEqual(payload);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/cloud-account-320.png", fullPage: true });
});

test("failed hydration blocks save and restore, preserving device data", async ({ page }) => {
  await page.route("https://workspace-fixture.supabase.co/**", route => route.fulfill({ status: 401, json: { code: "PGRST301" } }));
  await openPanel(page);
  await expect(page.getByRole("status")).toContainText("device copy is unchanged");
  await expect(page.getByRole("button", { name: "Save to account", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Restore from account", exact: true })).toBeDisabled();
});

test("explicit first save creates revision zero request and reports success only after acknowledgment", async ({ page }) => {
  let writes = 0;
  await page.route("https://workspace-fixture.supabase.co/**", route => {
    if (route.request().method() === "POST") {
      writes++;
      expect(route.request().postDataJSON()).toEqual({ p_payload: payload, p_expected_revision: 0 });
      return route.fulfill({ json: { ...row, revision: 1 } });
    }
    return route.fulfill({ json: [] });
  });
  await openPanel(page);
  await expect(page.getByRole("status")).toContainText("No account copy");
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Save to account", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved to your account.");
  expect(writes).toBe(1);
  await expect(page.getByRole("button", { name: "Restore from account", exact: true })).toBeEnabled();
});

test("malformed remote data cannot be restored or overwritten", async ({ page }) => {
  await page.route("https://workspace-fixture.supabase.co/**", route => route.fulfill({ json: [{ ...row, payload: { version: 2 } }] }));
  await openPanel(page);
  await expect(page.getByRole("status")).toContainText("Nothing was replaced");
  await expect(page.getByRole("button", { name: "Save to account", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Restore from account", exact: true })).toBeDisabled();
});

test("stale save requires refresh and never changes local data", async ({ page }) => {
  let writes = 0;
  await page.route("https://workspace-fixture.supabase.co/**", route => {
    if (route.request().method() === "POST") {
      writes++;
      expect(route.request().postDataJSON().p_expected_revision).toBe(2);
      return route.fulfill({ status: 409, json: { code: "40001" } });
    }
    return route.fulfill({ json: [row] });
  });
  await openPanel(page);
  const save = page.getByRole("button", { name: "Save to account", exact: true });
  await expect(save).toBeEnabled();
  page.once("dialog", dialog => dialog.accept());
  await save.click();
  await expect(page.getByRole("status")).toContainText("another device");
  await expect(save).toBeDisabled();
  expect(writes).toBe(1);
  expect(await page.evaluate(() => (window as any).restored)).toBeUndefined();
});

test("a late account A response cannot populate account B", async ({ page }) => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  let requested = false;
  await page.route("https://workspace-fixture.supabase.co/**", async route => {
    if (route.request().url().includes("eq.user_A")) {
      requested = true;
      await pending;
      await route.fulfill({ json: [row] });
    } else await route.fulfill({ json: [] });
  });
  await openPanel(page);
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(() => (window as any).showOwner("user_B"));
  await expect(page.getByRole("status")).toContainText("No account copy");
  resolve();
  await expect(page.getByRole("button", { name: "Restore from account", exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("No account copy");
});
