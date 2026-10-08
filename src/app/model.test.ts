import { describe, expect, it } from "vitest";
import { pathForLegacyHash, viewFromPath, viewPaths, viewTitles } from "./model";

describe("viewFromPath", () => {
  it("finds the view for every path in the table", () => {
    for (const [view, path] of Object.entries(viewPaths)) expect(viewFromPath(path), path).toBe(view);
  });

  it("matches the way the router does: any letter case, trailing slashes, percent-encoding", () => {
    expect(viewFromPath("/Garage")).toBe("garage");
    expect(viewFromPath("/garage/")).toBe("garage");
    expect(viewFromPath("/COMMUNITY/Write/")).toBe("write");
    expect(viewFromPath("/%61ccount")).toBe("account");
    expect(viewFromPath("/%67arage")).toBe("garage");
  });

  it("treats anything else as Home, which is where the router sends it", () => {
    for (const path of ["/no-such-page", "//garage", "/garage/extra", "/community//write", "/%E0%A4%A", ""]) {
      expect(viewFromPath(path), path).toBe("top");
    }
  });

  it("has a title for every view", () => {
    expect(Object.keys(viewTitles).sort()).toEqual(Object.keys(viewPaths).sort());
  });
});

describe("pathForLegacyHash", () => {
  it("sends each old fragment to its path", () => {
    expect(pathForLegacyHash("#feed")).toEqual({ pathname: "/community", hash: "" });
    expect(pathForLegacyHash("#write")).toEqual({ pathname: "/community/write", hash: "" });
    expect(pathForLegacyHash("#garage")).toEqual({ pathname: "/garage", hash: "" });
    expect(pathForLegacyHash("#compare")).toEqual({ pathname: "/compare", hash: "" });
    expect(pathForLegacyHash("#account")).toEqual({ pathname: "/account", hash: "" });
    expect(pathForLegacyHash("#pit-stop")).toEqual({ pathname: "/pit-stop", hash: "" });
  });

  it("keeps a Pit Stop collection's fragment", () => {
    expect(pathForLegacyHash("#pit-stop-builds")).toEqual({ pathname: "/pit-stop", hash: "#pit-stop-builds" });
  });

  it("leaves every other fragment alone", () => {
    for (const hash of ["", "#", "#top", "#Feed", "#note-detail", "#/sso-callback", "#__proto__", "#toString", "#feed/extra"]) {
      expect(pathForLegacyHash(hash), hash).toBeNull();
    }
  });
});
