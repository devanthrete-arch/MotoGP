// Fails when what a visitor downloads grows past its budget.
// Run after `npm run build`:  node scripts/check-bundle-size.mjs
// Budgets are gzip bytes. "initial" is what the first page load fetches (the files index.html
// references); "total" is every script in the build, including views fetched on demand.
// Raise a budget only with a reason in the PR.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

// First load is 133 kB today: React and React DOM, Clerk, the router (about 19 kB), the database
// client (about 25 kB, a candidate for loading on demand) and the shared state for every view.
export const budgets = { initialJs: 136_000, totalJs: 150_000, css: 13_000 };

/** Asset file names index.html loads up front: its scripts, module preloads and stylesheets. */
export function initialAssets(indexHtml) {
  const names = [];
  for (const match of indexHtml.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="[^"]*\/assets\/([^"]+\.(?:js|css))"/g)) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

/** Gzip sizes for a build directory containing index.html and assets/. */
export function measure(distDir) {
  const assetsDir = path.join(distDir, "assets");
  const gzip = (file) => gzipSync(readFileSync(path.join(assetsDir, file))).length;
  const initial = initialAssets(readFileSync(path.join(distDir, "index.html"), "utf8"));
  const all = readdirSync(assetsDir);
  const sum = (files) => files.reduce((total, file) => total + gzip(file), 0);
  return {
    initialJs: sum(initial.filter((file) => file.endsWith(".js"))),
    totalJs: sum(all.filter((file) => file.endsWith(".js"))),
    css: sum(all.filter((file) => file.endsWith(".css"))),
  };
}

const kilobytes = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
const labels = { initialJs: "First-load JavaScript", totalJs: "All JavaScript", css: "CSS" };

/** One line per measure that is over its limit; empty when everything fits. */
export function overBudget(sizes, limits = budgets) {
  return Object.keys(limits).filter((key) => sizes[key] > limits[key])
    .map((key) => `${labels[key] ?? key} is ${kilobytes(sizes[key])} gzip, over the ${kilobytes(limits[key])} budget by ${kilobytes(sizes[key] - limits[key])}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = path.resolve("dist");
  if (!existsSync(path.join(distDir, "assets"))) {
    console.error("dist/assets not found. Run `npm run build` first.");
    process.exit(1);
  }
  const sizes = measure(distDir);
  for (const key of Object.keys(budgets)) {
    console.log(`${labels[key].padEnd(22)} ${kilobytes(sizes[key]).padStart(9)} gzip   budget ${kilobytes(budgets[key])}`);
  }
  const problems = overBudget(sizes);
  if (problems.length) {
    for (const problem of problems) console.error(`::error::${problem}`);
    process.exit(1);
  }
}
