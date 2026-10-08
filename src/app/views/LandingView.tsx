// The public front page, shown at "/" to anyone who is not signed in.
//
// It reads nothing from the state hook except the registration number being typed: for a visitor
// the hook holds only example data, which must not be shown as theirs.
import { ArrowRight } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { Link, useHref, useLinkClickHandler, useNavigate } from "react-router";
import { Button, LinkButton, type LinkButtonProps } from "../../ui/Button";
import { PlateInput } from "../../ui/PlateInput";
import { parseRegistration, registrationProblemText } from "../../ui/plate";
import { destinations, memberViews, viewPaths } from "../model";
import { useOtofolks } from "../state";

// What each area holds today. Checked against the views: nothing here is planned or implied.
const about: Record<"garage" | "feed" | "pit-stop" | "compare", string> = {
  garage: "Your vehicles, a maintenance timeline of what was done and what it cost, a running-cost ledger and reminders.",
  feed: "Notes from owners, labelled as reviews, known issues, fixes, cost notes and travelogues. Save what helps and join the discussion.",
  "pit-stop": "Car collections grouped as builds, launches, ownership and India. Each one opens on Instagram.",
  compare: "Shortlist cars and read two side by side across twelve categories, with manufacturer-verified specifications where available. It will not pick a winner from incomplete data.",
};
const areas = destinations.filter((destination) => destination.id !== "top");

// A pill that moves within the app. The button primitive itself stays free of the router.
function RouteButton({ to, ...rest }: Omit<LinkButtonProps, "href"> & { to: string }) {
  return <LinkButton {...rest} href={useHref(to)} onClick={useLinkClickHandler(to)} />;
}

export function LandingView() {
  const { plateDraft, setPlateDraft } = useOtofolks();
  const navigate = useNavigate();
  const field = useRef<HTMLInputElement>(null);
  // An error waits until the visitor has left the field or tried to continue.
  const [checked, setChecked] = useState(false);
  const registration = parseRegistration(plateDraft);

  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registration.ok) {
      setChecked(true);
      field.current?.focus();
      return;
    }
    // The number is already held by the tab (the state hook keeps the two in step as it is typed),
    // so it is still here after the page load that ends a sign-in. It is never put in the address:
    // the address is what the sign-in provider is given to come back to.
    navigate(viewPaths.garage);
  };

  return (
    <section className="landing" aria-labelledby="landing-title">
      <div className="landing-head">
        <p className="landing-eyebrow">For car owners in India</p>
        <h1 id="landing-title"><span>Every car has a number.</span> <span>Start with yours.</span></h1>
        <p className="landing-lede">Keep your car's records, compare your next one, and learn from fellow owners.</p>
      </div>

      <form className="landing-form" noValidate onSubmit={start}>
        {/* The stage: where a 3D model of the vehicle will stand. Today the number is the exhibit. */}
        <div className="landing-stage" data-ready={registration.ok ? "" : undefined}>
          <PlateInput ref={field} className="landing-plate" name="registration" enterKeyHint="go"
            label="Your registration number" aria-describedby="landing-note"
            value={plateDraft} onChange={(value) => setPlateDraft(value)}
            onBlur={(event) => { if (event.target.value) setChecked(true); }}
            hint={registration.ok ? "That looks like a complete number." : "Type it as it appears on your number plate."}
            error={checked && !registration.ok ? registrationProblemText[registration.problem] : undefined} />
        </div>
        <Button className="landing-go" type="submit" variant="primary" trailingIcon={<ArrowRight size={18} aria-hidden="true" />}>
          Continue to my garage
        </Button>
        <p className="landing-note" id="landing-note">
          This starts adding your car to My garage, after you sign in. The number stays on this device. We do not look it up.
        </p>
      </form>

      <div className="landing-paths">
        <RouteButton to={viewPaths.compare}>Find my next car</RouteButton>
        <RouteButton to={viewPaths.feed}>Read owner stories</RouteButton>
        <p className="landing-note">Compare is open to everyone. Owner stories open after you sign in.</p>
      </div>

      <div className="landing-today">
        <h2>What is here today</h2>
        <ol className="landing-list" role="list">
          {areas.map(({ id, label }, index) => (
            <li className="landing-item" key={id}>
              <b aria-hidden="true">{String(index + 1).padStart(2, "0")}</b>
              <h3><Link to={viewPaths[id]}>{label}</Link></h3>
              <p>{about[id]}</p>
              <small>{memberViews.has(id) ? "Needs sign-in" : "Open to everyone"}</small>
            </li>
          ))}
        </ol>
        <p className="landing-note">
          What you keep in My garage and Compare stays on this device. Once you sign in, you can also save a copy to
          your account and restore it, only when you choose. Notes you publish in Community are shared with signed-in members.
        </p>
      </div>
    </section>
  );
}
