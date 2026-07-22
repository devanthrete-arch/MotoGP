import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";

describe("Autoflex web manifest", () => {
  it("declares an installable standalone app shell", () => {
    expect(manifest).toMatchObject({
      display: "standalone",
      name: "Autoflex",
      start_url: "/",
    });
    expect(manifest.icons[0]).toMatchObject({
      purpose: "any maskable",
      src: "/icon.svg",
    });
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(["/#write", "/#garage", "/#notebooks"]);
  });
});
