// Clerk's side of sign-in: where it returns to, and the account panel shown in Account.
import { SignInButton, SignUpButton, UserButton, useClerk, useUser } from "@clerk/react";
import { LogOut } from "lucide-react";
import { forgetVisitorData } from "../visitor";
import { redirectsFor, returnAddress } from "./signInReturn";

// Where Clerk sends the visitor after signing in: the page they asked for, or the one they are on.
export const clerkReturnUrl = (destination?: string) => returnAddress(window.location.href, destination);

export const ClerkAccountPanel = ({ savedCount }: { savedCount: number }) => {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const metadataRole = typeof user?.publicMetadata?.role === "string" ? user.publicMetadata.role : "";
  // A label only. Moderator powers live in the database (community_moderators), not here, and only the
  // sign-in provider's backend can set this metadata.
  const role = metadataRole === "moderator" ? "Moderator" : "User";

  if (!isLoaded) {
    return <p>Loading Clerk sign-in…</p>;
  }

  return isSignedIn ? (
    <>
      <div className="instrument-metrics">
        <span>
          <strong>{role}</strong>
          Role
        </span>
        <span>
          <strong>{savedCount}</strong>
          Saved notes
        </span>
        <span>
          <strong>{user?.firstName ?? "Signed in"}</strong>
          Profile
        </span>
      </div>
      <div className="auth-actions">
        <UserButton />
        <span>{email}</span>
        <button className="secondary-action" type="button" onClick={() => {
          // The tab may still hold a number typed before signing in; the next person must not inherit it.
          // (However else a session ends, claimTab in src/visitor.ts does the same on the next render.)
          forgetVisitorData();
          void clerk.signOut({ redirectUrl: "/" });
        }}>
          <LogOut size={18} aria-hidden="true" /> Log out
        </button>
      </div>
    </>
  ) : (
    <>
      <h2>Make yourself at home</h2>
      <p>Keep your favourite advice and car comparisons together.</p>
      <div className="auth-actions">
        <SignInButton mode="modal" {...redirectsFor("sign-in", clerkReturnUrl())}>
          <button className="primary-action" type="button">
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="modal" {...redirectsFor("sign-up", clerkReturnUrl())}>
          <button className="secondary-action" type="button">
            Create account
          </button>
        </SignUpButton>
      </div>
    </>
  );
};
