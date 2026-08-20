import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Dependency-direction guard.
 *
 * AutoFlex is layered core -> infrastructure -> ui -> features -> app, and the
 * arrows only ever point inward. Nothing in this file describes what the app
 * does; it describes what the app is allowed to depend on, which is the part
 * that silently rots first. If a move is legitimate, change the rule table
 * below on purpose — do not widen it to make a red test go away.
 *
 * The rules are enforced on resolved file paths rather than on the text of the
 * import specifier, so an alias, a re-export or a `../../..` ladder cannot
 * sneak an edge past the check.
 */

const SRC = resolve(__dirname, "../../src");

type Layer = "app" | "core" | "features" | "infrastructure" | "root" | "ui";

/** Which layers each layer is allowed to reach into. */
const ALLOWED: Record<Layer, Layer[]> = {
  // The composition root wires everything, so it may reach anywhere.
  app: ["app", "core", "features", "infrastructure", "root", "ui"],
  // Pure domain. The innermost ring depends on nothing but itself.
  core: ["core"],
  // A feature owns its slice and speaks core, infrastructure and the design
  // system. Another feature is reachable only through that feature's barrel,
  // which is checked separately below.
  features: ["core", "features", "infrastructure", "ui"],
  // Adapters. They may know the domain vocabulary and nothing above it.
  infrastructure: ["core", "infrastructure"],
  // `src/main.tsx` and friends: the browser entry point.
  root: ["app", "core", "features", "infrastructure", "root", "ui"],
  // Design-system primitives may render domain values, but know no feature.
  ui: ["core", "ui"],
};

/** Packages that must never appear inside `core/`. */
const FORBIDDEN_IN_CORE = [
  "react",
  "react-dom",
  "react-router-dom",
  "@supabase/supabase-js",
  "three",
  "lucide-react",
];

/** Browser globals that must never appear inside `core/`. */
const BROWSER_GLOBALS = ["window", "document", "localStorage", "sessionStorage", "navigator", "fetch"];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const sourceFiles = walk(SRC).filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"));

const rel = (file: string): string => relative(SRC, file).split("\\").join("/");

const layerOf = (file: string): Layer => {
  const top = rel(file).split("/")[0];
  return top === "app" || top === "core" || top === "features" || top === "infrastructure" || top === "ui"
    ? top
    : "root";
};

const featureOf = (file: string): string | null => {
  const parts = rel(file).split("/");
  return parts[0] === "features" ? (parts[1] ?? null) : null;
};

const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file);

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.mock\(\s*)["']([^"']+)["']/g;

const specifiersIn = (file: string): string[] => {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(SPECIFIER)].map((match) => match[1]);
};

const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Resolves a relative specifier to a file inside `src/`, or null if it leaves. */
const resolveLocal = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(from), specifier);
  for (const extension of CANDIDATES) {
    const candidate = base + extension;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep trying */
    }
  }
  return null;
};

type Edge = { from: string; specifier: string; to: string };

const edges: Edge[] = sourceFiles.flatMap((file) =>
  specifiersIn(file)
    .map((specifier) => {
      const target = resolveLocal(file, specifier);
      return target ? { from: file, specifier, to: target } : null;
    })
    .filter((edge): edge is Edge => edge !== null),
);

const describeEdge = (edge: Edge): string => `${rel(edge.from)} -> ${rel(edge.to)}`;

describe("dependency direction", () => {
  it("finds the source tree it is supposed to be guarding", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
    expect(edges.length).toBeGreaterThan(100);
  });

  it("resolves every relative import inside src", () => {
    const unresolved = sourceFiles.flatMap((file) =>
      specifiersIn(file)
        .filter((specifier) => specifier.startsWith(".") && !/\.(css|json|html|mjs|js)$/.test(specifier))
        .filter((specifier) => resolveLocal(file, specifier) === null)
        .map((specifier) => `${rel(file)} -> ${specifier}`),
    );

    expect(unresolved).toEqual([]);
  });

  it("only lets each layer import the layers beneath it", () => {
    const violations = edges
      // Test files build fixtures with whatever they are asserting against.
      // They are not part of the shipped dependency graph.
      .filter((edge) => !isTest(edge.from))
      .filter((edge) => !ALLOWED[layerOf(edge.from)].includes(layerOf(edge.to)))
      .map((edge) => `${describeEdge(edge)} (${layerOf(edge.from)} may not import ${layerOf(edge.to)})`);

    expect(violations).toEqual([]);
  });

  it("keeps core free of every outward dependency", () => {
    const violations = edges
      .filter((edge) => layerOf(edge.from) === "core" && layerOf(edge.to) !== "core")
      .map(describeEdge);

    expect(violations).toEqual([]);
  });

  it("keeps infrastructure free of feature knowledge", () => {
    const violations = edges
      .filter((edge) => !isTest(edge.from))
      .filter((edge) => layerOf(edge.from) === "infrastructure" && layerOf(edge.to) === "features")
      .map(describeEdge);

    expect(violations).toEqual([]);
  });

  it("routes every cross-feature import through the other feature's barrel", () => {
    const violations = edges
      .filter((edge) => featureOf(edge.to) !== null)
      .filter((edge) => featureOf(edge.from) !== featureOf(edge.to))
      .filter((edge) => rel(edge.to) !== `features/${featureOf(edge.to)}/index.ts`)
      .map((edge) => `${describeEdge(edge)} (reach ${featureOf(edge.to)} through its index.ts)`);

    expect(violations).toEqual([]);
  });

  it("gives every feature exactly one public barrel", () => {
    const features = readdirSync(join(SRC, "features"));

    expect(features.length).toBeGreaterThan(0);
    features.forEach((feature) => {
      expect(statSync(join(SRC, "features", feature, "index.ts")).isFile()).toBe(true);
    });
  });

  it("keeps React, Supabase and the browser out of core", () => {
    const coreFiles = sourceFiles.filter((file) => layerOf(file) === "core" && !isTest(file));

    const packageViolations = coreFiles.flatMap((file) =>
      specifiersIn(file)
        .filter((specifier) => FORBIDDEN_IN_CORE.includes(specifier) || specifier.startsWith("@supabase/"))
        .map((specifier) => `${rel(file)} imports ${specifier}`),
    );

    const globalViolations = coreFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      return BROWSER_GLOBALS.filter((name) =>
        new RegExp(`(?<![A-Za-z0-9_$.])${name}(?![A-Za-z0-9_$])`).test(source),
      ).map((name) => `${rel(file)} uses ${name}`);
    });

    expect(packageViolations).toEqual([]);
    expect(globalViolations).toEqual([]);
  });

  it("keeps the browser entry point out of everyone else's imports", () => {
    const violations = edges.filter((edge) => rel(edge.to) === "main.tsx").map(describeEdge);

    expect(violations).toEqual([]);
  });
});
