// Shown in place of a members-only view to someone who is not signed in.
import { Button } from "../ui/Button";
import { parseRegistration } from "../ui/plate";
import { type MemberView, viewPaths } from "./model";
import { useOtofolks } from "./state";

// What is behind each prompt. Fixed wording on purpose: for a visitor the state hook holds only
// example data, so nothing here may be counted or quoted from it.
const behind: Record<MemberView, { heading: string; body: string }> = {
  garage: {
    heading: "Sign in to open My garage",
    body: "My garage keeps your vehicles, their maintenance history and what each job cost.",
  },
  feed: {
    heading: "Owner notes are for signed-in members",
    body: "Owners share notes here with other members. Sign in to read them, save what helps and join the discussion.",
  },
  write: {
    heading: "Sign in to write an owner note",
    body: "A note you publish is shared with signed-in members.",
  },
};

export function SignInPrompt({ view }: { view: MemberView }) {
  const { clerkEnabled, requireSignIn, plateDraft } = useOtofolks();
  const { heading, body } = behind[view];
  // The number typed on the landing page, if any: the one thing here that is the visitor's own.
  const carried = view === "garage" ? parseRegistration(plateDraft) : null;
  return (
    <section className="panel auth-gate" aria-labelledby="sign-in-prompt-title">
      <div>
        <h2 id="sign-in-prompt-title">{heading}</h2>
        <p>{body}</p>
        {carried?.ok ? (
          <p>Your number <b className="auth-gate-plate">{carried.display}</b> is waiting in this tab.
            After you sign in it will be in the add-vehicle form.</p>
        ) : null}
        {clerkEnabled ? null : <p role="status">Sign-in is temporarily unavailable. Please try again later.</p>}
      </div>
      <div className="auth-actions">
        {/* After signing in the member comes back to this address, which then shows the view. */}
        <Button variant="primary" disabled={!clerkEnabled} onClick={() => requireSignIn(viewPaths[view])}>Sign in</Button>
        <Button disabled={!clerkEnabled} onClick={() => requireSignIn(viewPaths[view], "sign-up")}>Create account</Button>
      </div>
    </section>
  );
}
