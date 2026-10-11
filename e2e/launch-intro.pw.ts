import { expect, test, type Page } from "@playwright/test";
import { expectNoOverflow } from "./app";

const errors = new WeakMap<Page, string[]>();

async function mountIntro(page: Page, durationMs = 500) {
  await page.goto("/");
  await page.evaluate(async duration => {
    const host = document.createElement("div");
    window.launchIntroUnmount?.();
    host.id = "launch-intro-test-host";
    document.body.append(host);
    const { default: React } = await import("/node_modules/.vite/deps/react.js");
    const { default: ReactDOM } = await import("/node_modules/.vite/deps/react-dom_client.js");
    const { LaunchIntro } = await import("/src/app/LaunchIntro.tsx");
    window.launchIntroEvents = [];
    const root = ReactDOM.createRoot(host);
    window.launchIntroUnmount = () => root.unmount();
    root.render(React.createElement(LaunchIntro, {
      durationMs: duration,
      onClose: () => window.launchIntroEvents.push("close"),
      onComplete: () => window.launchIntroEvents.push("complete"),
    }));
  }, durationMs);
}

declare global {
  interface Window { launchIntroEvents: string[]; launchIntroUnmount?: () => void }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (new URL(location.href).searchParams.has("showIntroTest")) return;
    try { sessionStorage.setItem("otofolks.launch-intro.seen", "1"); } catch { /* direct component tests do not depend on storage */ }
  });
  errors.set(page, []);
  page.on("pageerror", error => errors.get(page)?.push(error.message));
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

for (const theme of ["light", "dark"] as const) {
  test(`intro is readable, animated and fits phone/desktop in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await mountIntro(page, 700);
    const intro = page.getByTestId("launch-intro");
    await expect(intro).toBeVisible();
    await expect(intro.getByRole("heading", { name: "Your journey, in good hands." })).toBeVisible();
    await expect(intro.getByRole("button", { name: "Skip intro" })).toBeVisible();
    await expect(intro.getByRole("button", { name: "Skip intro" })).toBeFocused();
    await expect(intro.locator(".launch-intro__needle")).toHaveCSS("animation-name", "launch-needle");
    await expectNoOverflow(page);
    await page.waitForTimeout(850);
    await expect(intro.locator(".launch-intro__needle")).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
    await expect(intro.locator(".launch-intro__arc")).toHaveCSS("stroke-dashoffset", "0px");
    await expect.poll(() => page.evaluate(() => window.launchIntroEvents)).toEqual(["complete"]);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoOverflow(page);
  });
}

test("Skip and Escape dismiss without also reporting animation completion", async ({ page }) => {
  await mountIntro(page, 500);
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect.poll(() => page.evaluate(() => window.launchIntroEvents)).toEqual(["close"]);
  await page.waitForTimeout(700);
  await expect.poll(() => page.evaluate(() => window.launchIntroEvents)).toEqual(["close"]);

  await mountIntro(page, 500);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.launchIntroEvents)).toEqual(["close"]);
  await page.waitForTimeout(700);
  await expect.poll(() => page.evaluate(() => window.launchIntroEvents)).toEqual(["close"]);
});

test("reduced motion completes immediately and status text stays static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mountIntro(page, 3000);
  await expect.poll(() => page.evaluate(() => window.launchIntroEvents)).toEqual(["complete"]);
  const status = page.locator(".launch-intro__sr-status");
  await expect(status).toHaveText("Loading Otofolks");
  await expect(status).not.toHaveAttribute("aria-live", "assertive");
});

test("home entry shows the speedometer once and skip reveals the app", async ({ page }) => {
  await page.goto("/?showIntroTest=1");
  const intro = page.getByTestId("launch-intro");
  await expect(intro).toBeVisible();
  await expect(intro).toHaveAttribute("aria-modal", "true");
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(intro).toHaveCount(0);
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await page.reload();
  await expect(page.getByTestId("launch-intro")).toHaveCount(0);
});
