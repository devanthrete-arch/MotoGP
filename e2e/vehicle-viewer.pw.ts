import { expect, test } from "@playwright/test";
import { expectNoOverflow, openApp, pageErrors } from "./app";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`vehicle stage stays responsive and loads 3D on demand at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const scripts: string[] = [];
    page.on("request", request => {
      if (/\.(?:js|tsx)(?:\?|$)/.test(request.url())) scripts.push(request.url());
    });
    await openApp(page, false);

    const poster = page.getByRole("img", { name: /Generic compact crossover concept/ });
    await expect(poster).toBeVisible();
    await expect(poster).toHaveJSProperty("complete", true);
    expect(scripts.some(url => /VehicleViewer|three|react-three-fiber/i.test(url))).toBe(false);
    await expectNoOverflow(page);

    await page.getByRole("button", { name: "View in 3D" }).click();
    const canvas = page.getByRole("img", { name: "Interactive 3D generic compact crossover concept" });
    await expect(canvas).toBeVisible();
    const renderedCanvas = canvas.locator("canvas");
    await expect(renderedCanvas).toBeVisible();
    await expect.poll(() => renderedCanvas.evaluate(element => {
      const target = element as HTMLCanvasElement;
      return target.width > 0 && target.height > 0 && target.getBoundingClientRect().width > 0;
    })).toBe(true);
    await expect.poll(() => scripts.some(url => /VehicleViewer|three|react-three-fiber/i.test(url))).toBe(true);

    await page.getByRole("button", { name: "Pearl white" }).click();
    await expect(page.getByRole("button", { name: "Pearl white" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Rotate vehicle right" }).click();
    await expect(page.locator(".vehicle-viewer")).not.toHaveAttribute("data-rotation", "0.000");
    await expectNoOverflow(page);

    await renderedCanvas.screenshot({ path: testInfo.outputPath(`vehicle-canvas-${viewport.name}.png`) });
    await page.screenshot({ path: testInfo.outputPath(`vehicle-stage-${viewport.name}.png`), fullPage: true });
    expect(pageErrors(page)).toEqual([]);
  });
}
