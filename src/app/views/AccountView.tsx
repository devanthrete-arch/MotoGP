// Account: sign-in, sign-out and the account copy of device data.
import { CloudWorkspacePanel } from "../../CloudWorkspacePanel";
import type { PrivateWorkspace } from "../../cloudWorkspace";
import { saveSaved } from "../../storage";
import { initialTimelineDraft } from "../model";
import { ClerkAccountPanel } from "../auth";
import { useOtofolks } from "../state";

export function AccountView() {
  const {
    auth, clerkEnabled, profile, shortlist, saved, setSaved, follows, garage, timeline, setTimelineDraft,
    activeView, persistFollows, persistProfile, persistShortlist, persistGarage, persistTimeline,
  } = useOtofolks();
  // Unlike the other views this one stays mounted and is only hidden, so a save to the account
  // that is still in flight when the member moves on is not lost.
  return (
    <section className="panel account-view" id="account" hidden={activeView !== "account"} aria-label="Account">
      {clerkEnabled ? <ClerkAccountPanel savedCount={saved.size} /> :
        <><h2>Sign-in is temporarily unavailable</h2><p>Please try again later.</p></>}
      {auth.isSignedIn && auth.userId ? <CloudWorkspacePanel
        client={auth.cloudClient ?? null} owner={auth.userId} configurationError={auth.cloudError}
        workspace={{ version: 1, profile, garage, timeline, shortlist, follows, saved: [...saved] }}
        onRestore={(data: PrivateWorkspace) => {
          persistProfile(data.profile);
          persistGarage(data.garage);
          persistTimeline(data.timeline);
          persistShortlist(data.shortlist);
          persistFollows(data.follows);
          setSaved(new Set(data.saved));
          saveSaved(new Set(data.saved));
          setTimelineDraft({ ...initialTimelineDraft, vehicleId: data.garage[0]?.id ?? "" });
        }}
      /> : null}
    </section>
  );
}
