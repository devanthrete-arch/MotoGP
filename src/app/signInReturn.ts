// Where the sign-in provider sends someone once they have signed in. Pure, so it can be tested
// without the provider or a browser.
import type { SignInMode } from "./model";

/**
 * The address to come back to: the page asked for, or the one the visitor is on. The query string
 * is kept. The fragment is kept only when staying on the same page (on Pit Stop it selects the
 * open collection); it means nothing on another page. `clerk_return` marks the load that follows
 * a sign-in and is stripped again at startup (src/main.tsx).
 */
export function returnAddress(currentHref: string, destination?: string): string {
  const url = new URL(currentHref);
  if (destination && destination !== url.pathname) {
    url.pathname = destination;
    url.hash = "";
  }
  url.searchParams.set("clerk_return", "1");
  return url.toString();
}

/**
 * The provider's sign-in and sign-up windows link to each other, so whichever one is opened is
 * told the return address for both. Otherwise someone who opens "Sign in" and switches to
 * "Sign up" lands on the provider's default page instead of where they were going.
 */
export function redirectsFor(mode: SignInMode, back: string) {
  return mode === "sign-up"
    ? { forceRedirectUrl: back, signInForceRedirectUrl: back }
    : { forceRedirectUrl: back, signUpForceRedirectUrl: back };
}
