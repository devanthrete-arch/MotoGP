// Renders every showroom car from the front three-quarter, the side and the rear three-quarter into one
// sheet, for checking model changes side by side. Needs the dev server running.
//   node scripts/showroom-review.mjs <base-url> <out.jpg> [car-id ...]
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [base, out, ...only] = process.argv.slice(2);
const { cars } = JSON.parse(readFileSync("public/showroom/manifest.json", "utf8"));
const list = only.length ? cars.filter((c) => only.includes(c.id)) : cars;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL, args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const shots = [];
for (const car of list) {
  await page.goto(`${base}/showroom?car=${car.id}`);
  await page.locator(".showroom canvas").waitFor({ timeout: 60_000 });
  await page.locator(".showroom-progress").waitFor({ state: "detached", timeout: 120_000 });
  await page.getByRole("button", { name: "Pause the turntable" }).click();
  await page.addStyleTag({ content: ".showroom__stage-controls { display: none !important; }" });
  const stage = page.locator(".showroom__stage");
  const box = await stage.boundingBox();
  const row = [];
  // Front three-quarter, then the side, then rear three-quarter: each drag turns the camera.
  for (const drag of [0, box.height * 0.13, box.height * 0.3]) {
    if (drag) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + drag, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForTimeout(2500);
    row.push((await stage.screenshot({ type: "jpeg", quality: 70 })).toString("base64"));
  }
  shots.push({ name: car.name, row });
}
await page.setViewportSize({ width: 1800, height: 300 * shots.length + 20 });
await page.setContent(`<body style="margin:0;background:#000;color:#fff;font:14px sans-serif">${shots.map((s) =>
  `<div style="display:flex;gap:4px;margin-bottom:4px;position:relative">${s.row.map((b) => `<img src="data:image/jpeg;base64,${b}" style="width:596px;height:296px;object-fit:cover">`).join("")}<span style="position:absolute;left:8px;top:6px">${s.name}</span></div>`).join("")}</body>`);
await page.screenshot({ path: out, type: "jpeg", quality: 75, fullPage: true });
await browser.close();
