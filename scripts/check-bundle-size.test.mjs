import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { budgets, measure, overBudget } from "./check-bundle-size.mjs";

describe("bundle budget", () => {
  it("adds up gzip sizes by kind and ignores other files", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "otofolks-bundle-"));
    try {
      writeFileSync(path.join(dir, "index-a.js"), "export const a = 1;".repeat(200));
      writeFileSync(path.join(dir, "chunk-b.js"), "export const b = 2;".repeat(200));
      writeFileSync(path.join(dir, "index.css"), ".a{color:red}".repeat(200));
      writeFileSync(path.join(dir, "font.woff2"), "x".repeat(50_000));
      const sizes = measure(dir);
      expect(sizes.js).toBeGreaterThan(0);
      expect(sizes.css).toBeGreaterThan(0);
      // Highly repetitive text compresses far below its raw size; the font is not counted at all.
      expect(sizes.js).toBeLessThan(2 * 200 * "export const a = 1;".length);
      expect(sizes.js + sizes.css).toBeLessThan(5_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes at the limit and names each kind that is over it", () => {
    expect(overBudget({ js: budgets.js, css: budgets.css })).toEqual([]);
    expect(overBudget({ js: 100, css: 50 }, { js: 100, css: 50 })).toEqual([]);
    const problems = overBudget({ js: 150_000, css: 10 }, { js: 135_000, css: 13_000 });
    expect(problems).toEqual(["JS is 150.0 kB gzip, over the 135.0 kB budget by 15.0 kB."]);
    expect(overBudget({ js: 2, css: 2 }, { js: 1, css: 1 })).toHaveLength(2);
  });
});
