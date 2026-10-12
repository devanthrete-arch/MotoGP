// Two fingers swiping up the page: the cue under the hero's button to keep scrolling. Pressing it scrolls on.
export function ScrollHint() {
  const go = () => window.scrollBy({ top: Math.round(window.innerHeight * 0.9), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return (
    <button className="lp-scrollhint" type="button" onClick={go} aria-label="Scroll down">
      <svg className="lp-scrollhint__icon" viewBox="12 0 40 72" width="46" height="83" aria-hidden="true" focusable="false">
        <g className="lp-scrollhint__arrows" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 6 v14 M26 12 l6 -6 l6 6" />
        </g>
        <g className="lp-scrollhint__fingers" fill="rgba(255,255,255,0.55)" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
          <rect x="19" y="30" width="11" height="30" rx="5.5" />
          <rect x="34" y="26" width="11" height="34" rx="5.5" />
          <path d="M17 54 q0 14 14 14 h6 q10 0 10 -12 v-6" fill="none" />
        </g>
      </svg>
      <span>Scroll</span>
    </button>
  );
}
