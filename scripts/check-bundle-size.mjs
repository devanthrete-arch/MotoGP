// Fails when the JavaScript or CSS a visitor downloads grows past its budget.
// Run after `npm run build`:  node scripts/check-bundle-size.mjs
// Budgets are gzip bytes for everything in dist/assets. Raise one only with a reason in the PR.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const budgets = { js: 135_000, css: 13_000 };

/** Total gzip size per kind for the files in a build's assets directory. */
export function measure(assetsDir) {
  const sizes = { js: 0, css: 0 };
  for (const file of readdirSync(assetsDir)) {
    const kind = file.endsWith(".js") ? "js" : file.endsWith(".css") ? "css" : null;
    if (kind) sizes[kind] += gzipSync(readFileSync(path.join(assetsDir, file))).length;
  }
  return sizes;
}

const kilobytes = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

/** One line per kind that is over its limit; empty when everything fits. */
export function overBudget(sizes, limits = budgets) {
  return Object.keys(limits).filter((kind) => sizes[kind] > limits[kind])
    .map((kind) => `${kind.toUpperCase()} is ${kilobytes(sizes[kind])} gzip, over the ${kilobytes(limits[kind])} budget by ${kilobytes(sizes[kind] - limits[kind])}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const assetsDir = path.resolve("dist/assets");
  if (!existsSync(assetsDir)) {
    console.error("dist/assets not found. Run `npm run build` first.");
    process.exit(1);
  }
  const sizes = measure(assetsDir);
  for (const kind of Object.keys(budgets)) {
    console.log(`${kind.toUpperCase().padEnd(3)} ${kilobytes(sizes[kind]).padStart(9)} gzip   budget ${kilobytes(budgets[kind])}`);
  }
  const problems = overBudget(sizes);
  if (problems.length) {
    for (const problem of problems) console.error(`::error::${problem}`);
    process.exit(1);
  }
}
