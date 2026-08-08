import { describe, expect, it } from "vitest";
import { routeFromHash, routeFromPath, titleForPath } from "./routing";

describe("Autoflex workspace routing", () => {
  it("maps stable product destinations to their screens", () => {
    expect(routeFromHash("#top")).toMatchObject({ nav: "home", screen: "home" });
    expect(routeFromHash("#shortlist")).toMatchObject({ nav: "shortlist", screen: "shortlist" });
    expect(routeFromHash("#garage")).toMatchObject({ nav: "garage", screen: "garage" });
    expect(routeFromHash("#feed")).toMatchObject({ nav: "community", screen: "community" });
  });

  it("opens the Community composer from the install shortcut", () => {
    expect(routeFromHash("#write")).toEqual({
      nav: "community",
      openComposer: true,
      screen: "community",
    });
  });

  it("keeps account utilities directly addressable", () => {
    expect(routeFromHash("#profile")).toMatchObject({ accountView: "profile", screen: "account" });
    expect(routeFromHash("#notifications")).toMatchObject({ accountView: "notifications", screen: "account" });
    expect(routeFromHash("#settings")).toMatchObject({ accountView: "settings", screen: "account" });
  });

  it("keeps the previous notebooks URL compatible with Shortlist", () => {
    expect(routeFromHash("#notebooks")).toMatchObject({ nav: "shortlist", screen: "shortlist" });
  });

  it("maps deep-linkable paths to product screens", () => {
    expect(routeFromPath("/")).toMatchObject({ nav: "home", screen: "home" });
    expect(routeFromPath("/shortlist")).toMatchObject({ nav: "shortlist", screen: "shortlist" });
    expect(routeFromPath("/garage")).toMatchObject({ nav: "garage", screen: "garage" });
    expect(routeFromPath("/community/note-123")).toMatchObject({ nav: "community", screen: "community" });
    expect(routeFromPath("/profile/saved")).toMatchObject({ accountView: "saved", nav: "account", screen: "account" });
  });

  it("gives primary and detail routes distinct document titles", () => {
    expect(titleForPath("/")).toBe("Today · Autoflex");
    expect(titleForPath("/community")).toBe("Owner notes · Autoflex");
    expect(titleForPath("/community/note-123")).toBe("Owner note · Autoflex");
  });
});
