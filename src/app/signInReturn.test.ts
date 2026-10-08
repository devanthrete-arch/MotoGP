import { describe, expect, it } from "vitest";
import { redirectsFor, returnAddress } from "./signInReturn";

describe("returnAddress", () => {
  it("returns to the page asked for, keeping the query and dropping the fragment of the page left behind", () => {
    expect(returnAddress("https://otofolks.example/?ref=mail#top", "/garage"))
      .toBe("https://otofolks.example/garage?ref=mail&clerk_return=1");
    expect(returnAddress("https://otofolks.example/compare", "/community/write"))
      .toBe("https://otofolks.example/community/write?clerk_return=1");
  });

  it("returns to the page the visitor is on when none is asked for, fragment included", () => {
    expect(returnAddress("https://otofolks.example/pit-stop#pit-stop-builds"))
      .toBe("https://otofolks.example/pit-stop?clerk_return=1#pit-stop-builds");
  });

  it("keeps the fragment when the page asked for is the one already open", () => {
    // The navigation's Sign in link asks to come back to the current path; on Pit Stop the
    // fragment is what selects the open collection.
    expect(returnAddress("https://otofolks.example/pit-stop#pit-stop-builds", "/pit-stop"))
      .toBe("https://otofolks.example/pit-stop?clerk_return=1#pit-stop-builds");
  });

  it("marks the load exactly once", () => {
    expect(returnAddress("https://otofolks.example/garage?clerk_return=1", "/garage"))
      .toBe("https://otofolks.example/garage?clerk_return=1");
  });
});

describe("redirectsFor", () => {
  const back = "https://otofolks.example/garage?clerk_return=1";

  it("gives the sign-in window the return address for itself and for sign-up", () => {
    expect(redirectsFor("sign-in", back)).toEqual({ forceRedirectUrl: back, signUpForceRedirectUrl: back });
  });

  it("gives the sign-up window the return address for itself and for sign-in", () => {
    expect(redirectsFor("sign-up", back)).toEqual({ forceRedirectUrl: back, signInForceRedirectUrl: back });
  });
});
