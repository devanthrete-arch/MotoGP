// Cuts the two Ambassador reference sheets (public/landing/ambassador/sheet-*.webp) into one picture per view and
// measures the car's outline from the render views, for the 3D model.
//
//   node scripts/ambassador-views.mjs         (needs Chrome: set PLAYWRIGHT_CHANNEL=chrome if Playwright has no browser)
//
// Writes public/landing/ambassador/<view>-render.webp (transparent background, soft floor shadow kept),
// <view>-sketch.webp (black ink on transparent), src/app/views/landing/ambassadorProfile.json (measurements for the
// 3D model) and ambassadorViews.json (just the picture sizes, small enough for the page itself).
// The browser does the pixel work (canvas), so no image library is needed.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public/landing/ambassador");
const asUrl = (file) => `data:image/webp;base64,${readFileSync(join(dir, file)).toString("base64")}`;

// Each view's region of the 1536 x 1024 sheets, chosen to sit in the white gaps between views.
const views = {
  front: [30, 8, 455, 335], rear: [470, 8, 865, 335], top: [875, 40, 1530, 330],
  side: [10, 340, 760, 630], sideR: [770, 340, 1530, 630],
  front34: [10, 632, 800, 985], rear34: [800, 632, 1530, 990],
};

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
const page = await browser.newPage();
await page.setContent("<canvas id=c></canvas>");

const result = await page.evaluate(async ({ renderUrl, sketchUrl, views }) => {
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const [render, sketch] = await Promise.all([load(renderUrl), load(sketchUrl)]);
  const read = (img, [x0, y0, x1, y1]) => {
    const c = document.createElement("canvas"); c.width = x1 - x0; c.height = y1 - y0;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return g.getImageData(0, 0, c.width, c.height);
  };
  const lumaAt = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const satAt = (d, i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mx ? (mx - mn) / mx : 0; };
  const toUrl = (data, x0, y0, x1, y1) => {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); const out = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((y + y0) * data.width + x + x0) * 4, o = (y * w + x) * 4; for (let k = 0; k < 4; k++) out.data[o + k] = data.data[s + k]; }
    g.putImageData(out, 0, 0);
    return c.toDataURL("image/webp", 0.92);
  };

  const out = {};
  for (const [name, rect] of Object.entries(views)) {
    // ----- render: flood the white background from the edges, keep a soft shadow, keep everything enclosed -----
    const img = read(render, rect), d = img.data, W = img.width, H = img.height;
    const isBg = (i) => lumaAt(d, i) > 150 && satAt(d, i) < 0.1;
    const bg = new Uint8Array(W * H), stack = [];
    const push = (x, y) => { const p = y * W + x; if (!bg[p] && isBg(p * 4)) { bg[p] = 1; stack.push(p); } };
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1);
    }
    // keep only the biggest connected shape: neighbouring views' edges can reach into the region
    const label = new Int32Array(W * H);
    let bestLabel = 0, bestSize = 0, next = 0;
    for (let p0 = 0; p0 < W * H; p0++) {
      if (bg[p0] || label[p0]) continue;
      next += 1; let size = 0; const st = [p0]; label[p0] = next;
      while (st.length) {
        const p = st.pop(); size += 1; const x = p % W, y = (p / W) | 0;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx; if (!bg[q] && !label[q]) { label[q] = next; st.push(q); }
        }
      }
      if (size > bestSize) { bestSize = size; bestLabel = next; }
    }
    for (let p = 0; p < W * H; p++) if (!bg[p] && label[p] !== bestLabel) bg[p] = 1;
    const solid = new Uint8Array(W * H);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let p = 0; p < W * H; p++) {
      const i = p * 4;
      if (bg[p]) { const a = Math.max(0, Math.min(1, (1 - lumaAt(d, i) / 255) * 1.15)); d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = a > 0.03 ? Math.round(a * 255) : 0; }
      else { d[i + 3] = 255; solid[p] = 1; const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    // a little room for the shadow below the car
    const sy1 = Math.min(H - 1, y1 + 6);
    const entry = { w: x1 - x0 + 1, h: y1 - y0 + 1, shadowH: sy1 - y0 + 1, render: toUrl(img, x0, y0, x1, sy1) };

    // ----- measurements from the solid shape -----
    if (name === "side" || name === "sideR") {
      const top = [], bottom = [];
      for (let x = x0; x <= x1; x++) {
        let t = -1, b = -1;
        for (let y = y0; y <= y1; y++) if (solid[y * W + x]) { if (t < 0) t = y; b = y; }
        top.push(t - y0); bottom.push(b - y0);
      }
      entry.top = top; entry.bottom = bottom;
      // dark tyre blobs in the lower part: centre and radius of the two wheels
      const dark = (x, y) => lumaAt(d, 0) >= 0 && solid[y * W + x] && (() => { const i = (y * W + x) * 4; return false; })();
      void dark;
    }
    if (name === "top") {
      const half = [], mid = [];
      for (let x = x0; x <= x1; x++) {
        let t = -1, b = -1;
        for (let y = y0; y <= y1; y++) if (solid[y * W + x]) { if (t < 0) t = y; b = y; }
        half.push((b - t + 1) / 2); mid.push((t + b) / 2 - y0);
      }
      entry.half = half; entry.mid = mid;
    }
    if (name === "front" || name === "rear") {
      const half = [], mid = [];
      for (let y = y0; y <= y1; y++) {
        let l = -1, r = -1;
        for (let x = x0; x <= x1; x++) if (solid[y * W + x]) { if (l < 0) l = x; r = x; }
        half.push(l < 0 ? 0 : (r - l + 1) / 2); mid.push(l < 0 ? 0 : (l + r) / 2 - x0);
      }
      entry.half = half; entry.mid = mid;
    }
    if (name === "side" || name === "sideR") {
      // tyre centres: weighted centroid of near-black pixels in the lowest 45% of the shape
      const blobs = [];
      const ys = y0 + Math.floor((y1 - y0) * 0.55);
      const cols = new Float64Array(x1 - x0 + 1);
      for (let y = ys; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; if (solid[y * W + x] && lumaAt(d, i) < 55) cols[x - x0] += 1; }
      // split into two groups around the lightest gap near the middle
      const mid = Math.floor(cols.length / 2);
      let gap = mid, best = Infinity;
      for (let x = Math.floor(cols.length * 0.35); x < Math.floor(cols.length * 0.65); x++) if (cols[x] < best) { best = cols[x]; gap = x; }
      for (const [a, b] of [[0, gap], [gap, cols.length]]) {
        let sw = 0, sx = 0, minX = b, maxX = a;
        for (let x = a; x < b; x++) if (cols[x] > 6) { sw += cols[x]; sx += cols[x] * x; if (x < minX) minX = x; if (x > maxX) maxX = x; }
        blobs.push({ cx: sx / sw, r: (maxX - minX) / 2 });
      }
      entry.wheels = blobs;
    }

    // ----- sketch: black ink with alpha from darkness -----
    const sk = read(sketch, rect), sd = sk.data;
    for (let i = 0; i < sd.length; i += 4) {
      const a = Math.max(0, Math.min(1, (1 - lumaAt(sd, i) / 255 - 0.08) * 1.35));
      sd[i] = sd[i + 1] = sd[i + 2] = 20; sd[i + 3] = Math.round(a * 255);
    }
    let sx0 = sk.width, sy0 = sk.height, sx1 = 0, sy1b = 0;
    for (let p = 0; p < sk.width * sk.height; p++) if (sd[p * 4 + 3] > 120) { const x = p % sk.width, y = (p / sk.width) | 0; if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1b) sy1b = y; }
    entry.sketchW = Math.min(sk.width - 1, sx1 + 3) - Math.max(0, sx0 - 3) + 1; entry.sketchH = Math.min(sk.height - 1, sy1b + 3) - Math.max(0, sy0 - 3) + 1;
    entry.sketch = toUrl(sk, Math.max(0, sx0 - 3), Math.max(0, sy0 - 3), Math.min(sk.width - 1, sx1 + 3), Math.min(sk.height - 1, sy1b + 3));
    out[name] = entry;
  }
  return out;
}, { renderUrl: asUrl("sheet-render.webp"), sketchUrl: asUrl("sheet-sketch.webp"), views });

const profile = {}, sizes = {};
for (const [name, v] of Object.entries(result)) {
  writeFileSync(join(dir, `${name}-render.webp`), Buffer.from(v.render.split(",")[1], "base64"));
  writeFileSync(join(dir, `${name}-sketch.webp`), Buffer.from(v.sketch.split(",")[1], "base64"));
  const { render, sketch, ...rest } = v;
  profile[name] = rest;
  sizes[name] = { w: v.w, h: v.h, shadowH: v.shadowH, sketchW: v.sketchW, sketchH: v.sketchH };
  console.log(name.padEnd(8), `${v.w} x ${v.h}`, v.wheels ? "wheels " + JSON.stringify(v.wheels.map((w) => ({ cx: Math.round(w.cx), r: Math.round(w.r) }))) : "");
}
writeFileSync(join(root, "src/app/views/landing/ambassadorProfile.json"), JSON.stringify(profile));
writeFileSync(join(root, "src/app/views/landing/ambassadorViews.json"), JSON.stringify(sizes, null, 1));
await browser.close();
