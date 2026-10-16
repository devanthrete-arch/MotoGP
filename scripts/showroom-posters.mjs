// Photographs each showroom car for the still picture shown when a browser cannot draw 3D.
// Needs the dev server running:  npm run dev   then
//   node scripts/showroom-posters.mjs [base-url] [out-dir]
// Defaults to http://localhost:8080 and public/showroom. Set PLAYWRIGHT_CHANNEL (e.g. chrome or msedge)
// to use an installed browser instead of Playwright's own.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:8080";
const outDir = process.argv[3] ?? "public/showroom";
const { cars } = JSON.parse(readFileSync("public/showroom/manifest.json", "utf8"));

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL, args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
for (const car of cars) {
  await page.goto(`${base}/showroom?car=${car.id}`);
  await page.locator(".showroom canvas").waitFor({ timeout: 60_000 });
  // The overlay goes once the model has downloaded and its first frame is drawn.
  await page.locator(".showroom-progress").waitFor({ state: "detached", timeout: 120_000 });
  await page.getByRole("button", { name: "Pause the turntable" }).click();
  await page.addStyleTag({ content: ".showroom__stage-controls { display: none !important; }" });
  await page.waitForTimeout(2500);
  await page.locator(".showroom__stage").screenshot({ path: `${outDir}/${car.id}.jpg`, type: "jpeg", quality: 80 });
  console.log(`${outDir}/${car.id}.jpg`);
}
await browser.close();
