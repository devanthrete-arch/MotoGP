import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Everything under src/ that is not a test ends up in, or next to, the public JavaScript bundle.
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css|json)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

describe("client source", () => {
  it("holds no personal email addresses", () => {
    // Anyone can read the bundle. Addresses for moderators or staff belong on the server, not in code.
    const personal = /[\w.+-]+@(?:gmail|googlemail|yahoo|outlook|hotmail|live|icloud|proton|protonmail)\.[a-z.]+/gi;
    const found = sourceFiles("src").flatMap((file) => (readFileSync(file, "utf8").match(personal) ?? []).map((address) => `${file}: ${address}`));
    expect(found).toEqual([]);
  });
});
