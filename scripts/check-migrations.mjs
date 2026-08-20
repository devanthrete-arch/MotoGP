#!/usr/bin/env node
/**
 * Migration lint for supabase/migrations.
 *
 * Migrations are applied to a live Supabase Postgres that a *previously
 * deployed* frontend is still talking to, and the frontend deploys separately
 * (Vercel git integration). So every migration has to be safe against both the
 * old and the new client. This script enforces that mechanically:
 *
 *   1. Naming / ordering  - `<14-digit timestamp>_<snake_case>.sql`, unique and
 *      strictly increasing, so "apply in order" is unambiguous.
 *   2. Immutability       - an already-merged migration file may not be edited
 *      in place; the copy in the database will never be re-run, so an edit
 *      silently desynchronises environments. Checked against the PR merge base.
 *   3. Expand/contract    - destructive statements (drop column/table, rename,
 *      type change, set not null, truncate) are errors unless the file opts in
 *      with an explicit acknowledgement line, because they break the running
 *      frontend the moment they land.
 *   4. Lock-safety hints  - warnings for patterns that are correct but take
 *      heavier locks than necessary at scale.
 *
 * Errors exit 1. Warnings never fail the build - they are advice, printed so a
 * reviewer sees them on the PR.
 *
 * Usage:
 *   node scripts/check-migrations.mjs
 *   MIGRATION_BASE_REF=<sha> node scripts/check-migrations.mjs   # immutability check
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "supabase", "migrations");

/** Opt-out marker a migration author must add, with a reason, to run a contract-phase change. */
const ACK_PATTERN = /--\s*expand-contract:\s*contract-phase approved\s*:/i;
const FILE_PATTERN = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

const errors = [];
const warnings = [];

/**
 * Files touched by this PR, when CI hands us a merge base. Warnings are scoped
 * to these so a reviewer sees advice about their own migration instead of 70
 * lines about migrations that shipped months ago. Errors are never scoped.
 */
const baseRef = process.env.MIGRATION_BASE_REF || process.env.GITHUB_BASE_REF || "";
let changedFiles = null;
let immutabilityRows = [];
let baseRefError = "";
if (baseRef) {
  try {
    const changed = execFileSync(
      "git",
      ["diff", "--name-only", baseRef, "--", "supabase/migrations"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    changedFiles = new Set(changed.split("\n").filter(Boolean).map((path) => path.split("/").pop()));
    const diff = execFileSync(
      "git",
      ["diff", "--name-status", "--diff-filter=MDR", baseRef, "--", "supabase/migrations"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    immutabilityRows = diff.split("\n").filter(Boolean);
  } catch (error) {
    baseRefError = error instanceof Error ? error.message.split("\n")[0] : "unknown error";
  }
}

const addError = (file, line, message) => errors.push({ file, line, message });
const addWarning = (file, line, message) => warnings.push({ file, line, message });

/**
 * Blanks out a region while preserving newlines and total length, so byte
 * offsets and line numbers computed afterwards still line up with the source.
 */
const maskPreservingLayout = (text, pattern) =>
  text.replace(pattern, (match) => match.replace(/[^\n]/g, " "));

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** Comments, dollar-quoted bodies and string literals are not executable DDL. */
const executableSql = (raw) => {
  let masked = maskPreservingLayout(raw, /\/\*[\s\S]*?\*\//g);
  masked = maskPreservingLayout(masked, /--[^\n]*/g);
  masked = maskPreservingLayout(masked, /\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g);
  masked = maskPreservingLayout(masked, /'(?:[^']|'')*'/g);
  return masked.toLowerCase();
};

const destructiveRules = [
  [/\bdrop\s+table\b/g, "drops a table"],
  [/\bdrop\s+column\b/g, "drops a column"],
  [/\bdrop\s+(?:materialized\s+)?view\b/g, "drops a view"],
  [/\bdrop\s+(?:schema|database)\b/g, "drops a schema or database"],
  [/\balter\s+table\s+[^;]{0,200}?\brename\b/g, "renames a table or column"],
  [/\balter\s+column\s+[\w".]+\s+type\b/g, "changes a column type (table rewrite + old client breakage)"],
  [/\balter\s+column\s+[\w".]+\s+set\s+not\s+null\b/g, "adds NOT NULL to an existing column"],
  [/\btruncate\b/g, "truncates data"],
  [/\bdrop\s+policy\b(?![^;]{0,80}\bif\s+exists\b)/g, "drops an RLS policy without IF EXISTS"],
];

const warningRules = [
  [
    /\bcreate\s+table\s+(?!if\s+not\s+exists)/g,
    "CREATE TABLE without IF NOT EXISTS - a partially applied migration cannot be re-run cleanly",
  ],
  [
    /\bcreate\s+(?:unique\s+)?index\s+(?!concurrently)/g,
    "CREATE INDEX without CONCURRENTLY takes a write lock for the duration; fine at current row counts, revisit before the feed table grows",
  ],
  [
    /\bdrop\s+constraint\s+(?!if\s+exists)/g,
    "DROP CONSTRAINT without IF EXISTS is not re-runnable",
  ],
];

const files = readdirSync(migrationsDir).filter((name) => !name.startsWith("."));
const sqlFiles = files.filter((name) => name.endsWith(".sql")).sort();

for (const name of files) {
  if (!name.endsWith(".sql")) {
    addError(name, 0, "Only .sql files belong in supabase/migrations.");
  }
}

if (sqlFiles.length === 0) {
  addError("supabase/migrations", 0, "No migrations found - is the path correct?");
}

let previousTimestamp = "";
for (const name of sqlFiles) {
  const match = FILE_PATTERN.exec(name);
  if (!match) {
    addError(name, 0, "Name must be <14-digit timestamp>_<snake_case_description>.sql");
    continue;
  }
  const [, timestamp] = match;
  if (timestamp === previousTimestamp) {
    addError(name, 0, `Duplicate timestamp ${timestamp}: apply order would be ambiguous.`);
  }
  if (timestamp < previousTimestamp) {
    addError(name, 0, `Timestamp ${timestamp} sorts before ${previousTimestamp}.`);
  }
  previousTimestamp = timestamp;

  const raw = readFileSync(resolve(migrationsDir, name), "utf8");
  const sql = executableSql(raw);
  const acknowledged = ACK_PATTERN.test(raw);

  for (const [pattern, description] of destructiveRules) {
    pattern.lastIndex = 0;
    let hit;
    while ((hit = pattern.exec(sql)) !== null) {
      const line = lineOf(sql, hit.index);
      const message = `Contract-phase statement: ${description}. Split into expand -> backfill -> deploy -> contract, or add "-- expand-contract: contract-phase approved: <why the old client is gone>".`;
      if (acknowledged) addWarning(name, line, `Acknowledged ${description}.`);
      else addError(name, line, message);
    }
  }

  for (const [pattern, message] of warningRules) {
    pattern.lastIndex = 0;
    let hit;
    while ((hit = pattern.exec(sql)) !== null) {
      addWarning(name, lineOf(sql, hit.index), message);
    }
  }

  // `add column ... not null` with no default rewrites the table AND rejects
  // every insert from the currently-deployed frontend, which does not know the
  // column exists. Always an error.
  const addColumnPattern = /\badd\s+column\b[^;,]*?\bnot\s+null\b[^;,]*/g;
  let addHit;
  while ((addHit = addColumnPattern.exec(sql)) !== null) {
    if (!/\bdefault\b/.test(addHit[0])) {
      addError(
        name,
        lineOf(sql, addHit.index),
        "ADD COLUMN ... NOT NULL without DEFAULT breaks inserts from the already-deployed frontend. Add a DEFAULT, or add the column nullable and tighten it in a later contract migration.",
      );
    }
  }
}

// Immutability: an applied migration file may never change.
for (const row of immutabilityRows) {
  const [status, path] = row.split("\t");
  const verb = status?.startsWith("D") ? "deleted" : status?.startsWith("R") ? "renamed" : "modified";
  addError(
    path ?? row,
    0,
    `Migration file was ${verb} (${status}). Applied migrations are immutable - add a new migration instead.`,
  );
}
if (!baseRef) {
  addWarning("supabase/migrations", 0, "No MIGRATION_BASE_REF/GITHUB_BASE_REF set; immutability check skipped and warnings cover every file.");
} else if (baseRefError) {
  addWarning("supabase/migrations", 0, `Could not diff against ${baseRef} (${baseRefError}); immutability check skipped.`);
}

const scopedWarnings = warnings.filter(
  (item) => !changedFiles || changedFiles.has(item.file) || item.file === "supabase/migrations",
);

/** One line per (file, rule) with a hit count, so advice stays readable. */
const groupedWarnings = [...scopedWarnings
  .reduce((groups, item) => {
    const key = `${item.file}\u0000${item.message}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { count: 1, file: item.file, line: item.line, message: item.message });
    return groups;
  }, new Map())
  .values()];

const summary = [];
summary.push(
  `Checked ${sqlFiles.length} migration(s) in supabase/migrations` +
    (changedFiles ? ` (${changedFiles.size} changed in this branch; warnings scoped to those).` : "."),
);
for (const item of groupedWarnings) {
  summary.push(`warning  ${item.file}:${item.line}  ${item.message}${item.count > 1 ? ` (x${item.count})` : ""}`);
}
for (const item of errors) summary.push(`ERROR    ${item.file}:${item.line}  ${item.message}`);

console.log(summary.join("\n"));

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  const body = [
    "### Migration lint",
    "",
    `- migrations checked: **${sqlFiles.length}**`,
    `- errors: **${errors.length}**`,
    `- warnings: **${scopedWarnings.length}**`,
    "",
    ...(errors.length ? ["#### Errors", ...errors.map((item) => `- \`${item.file}:${item.line}\` ${item.message}`), ""] : []),
    ...(groupedWarnings.length ? ["<details><summary>Warnings</summary>", "", ...groupedWarnings.map((item) => `- \`${item.file}:${item.line}\` ${item.message}${item.count > 1 ? ` (x${item.count})` : ""}`), "", "</details>"] : []),
  ].join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${body}\n`);
}

if (errors.length) {
  console.error(`\n${errors.length} migration error(s). See docs/DEPLOYMENT.md "Database migrations".`);
  process.exit(1);
}
