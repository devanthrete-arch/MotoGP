import { describe, expect, it } from "vitest";
import { routeFromHash } from "./routing";

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
});
