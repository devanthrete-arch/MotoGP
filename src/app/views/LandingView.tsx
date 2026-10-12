// The public front page, shown at "/" to anyone who is not signed in: a design-studio hero, and a hand-over to
// sign-in when the visitor scrolls all the way through the studio.
//
// The app's own header and tab bar are hidden while it is shown (see landing.css).
import { Link } from "react-router";
import { viewPaths } from "../model";
import { useOtofolks } from "../state";
import { HeroStudio } from "./landing/HeroStudio";
import { ScrollHint } from "./landing/ScrollHint";

export function LandingView() {
  const { requireSignIn } = useOtofolks();
  return (
    <section className="landing lp" aria-label="Otofolks">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <filter id="lp-brush" x="-5%" y="-10%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="4" /><feDisplacementMap in="SourceGraphic" scale="5" /></filter>
      </svg>

      <HeroStudio onComplete={() => requireSignIn(viewPaths.top)}>
        {() => (
          <>
            <h1 id="landing-title" className="lp-hero__title"><span className="lp-brush">Make</span> it real</h1>
            <div className="lp-hero__bottom">
              <div className="lp-hero__ctas">
                <Link className="lp-btn lp-btn--blue" to={viewPaths.feed}>Join Community</Link>
              </div>
              <ScrollHint />
            </div>
          </>
        )}
      </HeroStudio>

    </section>
  );
}
