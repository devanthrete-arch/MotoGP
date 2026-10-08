import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { budgets, initialAssets, measure, overBudget } from "./check-bundle-size.mjs";

describe("bundle budget", () => {
  it("reads the files a first load fetches from index.html and nothing else", () => {
    const html = `<link rel="icon" href="/icon.svg" />
      <script type="module" crossorigin src="/assets/index-a1.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/vendor-b2.js">
      <link rel="stylesheet" crossorigin href="/assets/index-c3.css">
      <link rel="manifest" href="/manifest.json" />`;
    expect(initialAssets(html)).toEqual(["index-a1.js", "vendor-b2.js", "index-c3.css"]);
    expect(initialAssets("<p>no assets</p>")).toEqual([]);
  });

  it("separates first-load scripts from scripts fetched on demand, and ignores fonts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "otofolks-bundle-"));
    try {
      mkdirSync(path.join(dir, "assets"));
      writeFileSync(path.join(dir, "index.html"),
        '<script type="module" src="/assets/index-a.js"></script><link rel="stylesheet" href="/assets/index.css">');
      writeFileSync(path.join(dir, "assets", "index-a.js"), "export const a = 1;".repeat(200));
      writeFileSync(path.join(dir, "assets", "FeedView-b.js"), "export const view = 2;".repeat(400));
      writeFileSync(path.join(dir, "assets", "index.css"), ".a{color:red}".repeat(200));
      writeFileSync(path.join(dir, "assets", "font.woff2"), "x".repeat(50_000));
      const sizes = measure(dir);
      expect(sizes.initialJs).toBeGreaterThan(0);
      expect(sizes.totalJs).toBeGreaterThan(sizes.initialJs);
      expect(sizes.css).toBeGreaterThan(0);
      // Repetitive text compresses far below its raw size, and the 50 kB font is not counted.
      expect(sizes.totalJs + sizes.css).toBeLessThan(5_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes at the limit and names each measure that is over it", () => {
    expect(overBudget({ ...budgets })).toEqual([]);
    const limits = { initialJs: 125_000, totalJs: 150_000, css: 13_000 };
    expect(overBudget({ initialJs: 140_000, totalJs: 100, css: 10 }, limits))
      .toEqual(["First-load JavaScript is 140.0 kB gzip, over the 125.0 kB budget by 15.0 kB."]);
    // The shipped budgets leave headroom, but not much: a new dependency should trip them.
    expect(budgets.initialJs).toBeLessThanOrEqual(140_000);
    expect(budgets.totalJs).toBeGreaterThanOrEqual(budgets.initialJs);
    expect(overBudget({ initialJs: 2, totalJs: 2, css: 2 }, { initialJs: 1, totalJs: 1, css: 1 })).toHaveLength(3);
  });
});
