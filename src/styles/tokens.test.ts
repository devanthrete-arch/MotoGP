import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

// Body of the first rule whose selector text contains `marker`.
const block = (marker: string): string => {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`No block for ${marker}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}" && (depth -= 1) === 0) return css.slice(open + 1, index);
  }
  throw new Error(`Unclosed block for ${marker}`);
};

const declarations = (body: string): Map<string, string> => new Map(
  [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].replace(/\s+/g, " ").trim()]),
);

const light = declarations(block(":root {"));
const darkSystem = declarations(block(':root:not([data-theme="light"])'));
const darkChosen = declarations(block(':root[data-theme="dark"]'));
const dark = new Map([...light, ...darkChosen]);

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (theme: Map<string, string>, foreground: string, background: string): number => {
  const [a, b] = [foreground, background].map(name => {
    const value = theme.get(name);
    if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} must be a six-digit hex colour, got ${value}`);
    return luminance(value);
  });
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

describe("design tokens", () => {
  it("turns glass opaque under reduced transparency in both themes", () => {
    // The dark blocks have higher specificity than a bare :root, so the override must name them too.
    const start = css.indexOf("@media (prefers-reduced-transparency: reduce)");
    const selectors = css.slice(start, css.indexOf("--glass-fill", start));
    for (const selector of [":root,", ':root[data-theme="dark"],', ':root:not([data-theme="light"])']) {
      expect(selectors).toContain(selector);
    }
  });

  it("keeps the two dark blocks identical", () => {
    expect([...darkSystem]).toEqual([...darkChosen]);
    expect(darkChosen.size).toBeGreaterThan(20);
  });

  // Text sits on the page gradient and on cards, so each text colour is checked against every
  // gradient stop and every solid surface of its theme. 4.5:1 is WCAG AA for body text.
  const text = ["--color-text", "--color-text-secondary", "--color-text-muted", "--color-primary-text", "--color-accent-text",
    "--color-success", "--color-danger"];
  const themes = [
    { name: "light", tokens: light, grounds: ["--ivory-0", "--ivory-1", "--ivory-2", "--color-bg", "--color-surface", "--color-surface-sunken"] },
    { name: "dark", tokens: dark, grounds: ["--slate-0", "--slate-1", "--slate-2", "--color-bg", "--color-surface", "--color-surface-raised", "--color-surface-sunken"] },
  ];
  for (const { name, tokens, grounds } of themes) {
    for (const foreground of text) {
      it(`${name}: ${foreground} reads at AA on every ground`, () => {
        for (const ground of grounds) {
          expect(contrast(tokens, foreground, ground), `${foreground} on ${ground}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
    it(`${name}: primary button text reads at AA on the button`, () => {
      const stops = [...(tokens.get("--gradient-primary") ?? "").matchAll(/#[0-9a-f]{6}/gi)].map(match => match[0]);
      expect(stops).toHaveLength(2);
      const label = luminance(tokens.get("--color-on-primary") ?? "");
      for (const stop of stops) {
        const fill = luminance(stop);
        expect((Math.max(label, fill) + 0.05) / (Math.min(label, fill) + 0.05), `label on ${stop}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${name}: amber text reads at AA on its own opaque chip ground`, () => {
      // Chips and pressed filters sit on glass and gradients; an opaque ground keeps this ratio fixed.
      expect(contrast(tokens, "--color-accent-text", "--color-accent-surface")).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: header text and the accent fill stay legible`, () => {
      // White nav text on the header bar; accent as a fill or large numeral needs 3:1.
      const header = luminance(tokens.get("--color-header") ?? "");
      expect(1.05 / (header + 0.05)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens, "--color-accent", "--color-bg")).toBeGreaterThanOrEqual(3);
    });
  }
});
