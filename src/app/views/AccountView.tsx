// Account: sign-in, sign-out and the account copy of device data.
import { Suspense } from "react";
import { useLocation } from "react-router";
import type { PrivateWorkspace } from "../../cloudWorkspace";
import { saveSaved } from "../../storage";
import { fetchedView, ViewBoundary } from "../fetched";
import { initialTimelineDraft } from "../model";
import { useOtofolks } from "../state";

// Only a signed-in member has an account copy, so only they download the panel that manages it.
const AccountCopyPanel = fetchedView(() => import("../../CloudWorkspacePanel"), (module) => module.CloudWorkspacePanel);

export function AccountView() {
  const {
    auth, accountPanel: AccountPanel, profile, shortlist, saved, setSaved, follows, garage, timeline, setTimelineDraft,
    activeView, persistFollows, persistProfile, persistShortlist, persistGarage, persistTimeline,
  } = useOtofolks();
  const location = useLocation();
  // Unlike the other views this one stays mounted and is only hidden, so a save to the account
  // that is still in flight when the member moves on is not lost.
  return (
    <section className="panel account-view" id="account" hidden={activeView !== "account"} aria-label="Account">
      {AccountPanel ? <AccountPanel savedCount={saved.size} /> :
        <><h2>Sign-in is temporarily unavailable</h2><p>Please try again later.</p></>}
      {/* The account copy is exactly these six parts. Registration numbers are not among them: they stay on the device. */}
      {auth.isSignedIn && auth.userId ? (
        <ViewBoundary resetKey={location.key}>
          <Suspense fallback={null}>
            <AccountCopyPanel
              client={auth.cloudClient ?? null} owner={auth.userId} configurationError={auth.cloudError}
              workspace={{ version: 2, profile, garage, timeline, shortlist, follows, saved: [...saved] }}
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
            />
          </Suspense>
        </ViewBoundary>
      ) : null}
    </section>
  );
}
