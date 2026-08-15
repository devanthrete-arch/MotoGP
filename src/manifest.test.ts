import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";

describe("Autoflex web manifest", () => {
  it("declares an installable standalone app shell", () => {
    expect(manifest).toMatchObject({
      display: "standalone",
      name: "AutoFlex",
      start_url: "/",
    });
    expect(manifest.icons[1]).toMatchObject({
      purpose: "any maskable",
      sizes: "512x512",
      src: "/icon-512.png",
    });
    // Obsidian Velocity dark surface — must match index.html theme-color.
    expect(manifest).toMatchObject({
      background_color: "#141313",
      theme_color: "#141313",
    });
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(["/#write", "/#shortlist", "/#garage"]);
  });
});
