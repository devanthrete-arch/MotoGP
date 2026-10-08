// Sign-in surfaces: the account panel and the gate shown to signed-out visitors.
import { SignInButton, SignUpButton, UserButton, useClerk, useUser } from "@clerk/react";
import { LogOut } from "lucide-react";
import { isAdminModeratorEmail } from "./model";

// Where Clerk sends the visitor after signing in: the page they asked for, or the one they are on.
export const clerkReturnUrl = (destination?: string) => {
  const url = new URL(window.location.href);
  if (destination) {
    url.pathname = destination;
    url.hash = "";
  }
  url.searchParams.set("clerk_return", "1");
  return url.toString();
};

export const ClerkAccountPanel = ({ savedCount }: { savedCount: number }) => {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const metadataRole = typeof user?.publicMetadata?.role === "string" ? user.publicMetadata.role : "";
  const role = metadataRole === "moderator" || (email && isAdminModeratorEmail(email)) ? "Moderator" : "User";

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
        <button className="secondary-action" type="button" onClick={() => void clerk.signOut({ redirectUrl: "/" })}>
          <LogOut size={18} aria-hidden="true" /> Log out
        </button>
      </div>
    </>
  ) : (
    <>
      <h2>Make yourself at home</h2>
      <p>Keep your favourite advice and car comparisons together.</p>
      <div className="auth-actions">
        <SignInButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
          <button className="primary-action" type="button">
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
          <button className="secondary-action" type="button">
            Create account
          </button>
        </SignUpButton>
      </div>
    </>
  );
};

export const LoginGate = ({ isLoaded }: { isLoaded: boolean }) => (
  <section className="panel auth-gate" aria-label="Sign in required">
    <div>
      <h2>Your Otofolks starts here</h2>
      <p>Sign in to join other owners and save what helps.</p>
    </div>
    <div className="auth-actions">
      <SignInButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
        <button className="primary-action" disabled={!isLoaded} type="button">
          Log in
        </button>
      </SignInButton>
      <SignUpButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
        <button className="secondary-action" disabled={!isLoaded} type="button">
          Create account
        </button>
      </SignUpButton>
    </div>
  </section>
);
