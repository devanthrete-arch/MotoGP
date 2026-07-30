import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";

describe("Autoflex web manifest", () => {
  it("declares an installable standalone app shell", () => {
    expect(manifest).toMatchObject({
      display: "standalone",
      name: "Autoflex",
      start_url: "/",
    });
    expect(manifest.icons[1]).toMatchObject({
      purpose: "any maskable",
      sizes: "512x512",
      src: "/icon-512.png",
    });
    expect(manifest).toMatchObject({
      background_color: "#eef2f0",
      theme_color: "#101b17",
    });
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(["/#write", "/#shortlist", "/#garage"]);
  });
});
