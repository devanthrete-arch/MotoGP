import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import "./LaunchIntro.css";

export type LaunchIntroProps = {
  onClose: () => void;
  onComplete: () => void;
  durationMs?: number;
};

export function LaunchIntro({ onClose, onComplete, durationMs = 2600 }: LaunchIntroProps) {
  const settled = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const onCompleteRef = useRef(onComplete);
  const onCloseRef = useRef(onClose);
  onCompleteRef.current = onComplete;
  onCloseRef.current = onClose;
  const complete = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onCompleteRef.current();
  }, []);
  const close = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      complete();
      return;
    }
    const timer = window.setTimeout(complete, durationMs + 100);
    return () => window.clearTimeout(timer);
  }, [complete, durationMs]);

  useEffect(() => {
    skipRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        event.preventDefault();
        skipRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return (
    <section className="launch-intro" role="dialog" aria-modal="true" aria-labelledby="launch-intro-title" data-testid="launch-intro"
      style={{ "--launch-duration": `${durationMs}ms` } as CSSProperties}>
      <div className="launch-intro__content">
        <p className="launch-intro__eyebrow">A better way to care for your vehicle</p>
        <h1 id="launch-intro-title">Your journey, in good hands.</h1>
        <div className="launch-intro__gauge" aria-hidden="true">
          <svg viewBox="0 0 320 190" role="presentation">
            <path className="launch-intro__track" d="M 34 164 A 126 126 0 0 1 286 164" />
            <path className="launch-intro__arc" d="M 34 164 A 126 126 0 0 1 286 164" />
            {[...Array(9)].map((_, index) => {
              const angle = (-180 + index * 22.5) * Math.PI / 180;
              const x1 = 160 + Math.cos(angle) * 108;
              const y1 = 164 + Math.sin(angle) * 108;
              const x2 = 160 + Math.cos(angle) * 119;
              const y2 = 164 + Math.sin(angle) * 119;
              return <line key={index} className="launch-intro__tick" x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
            <g className="launch-intro__needle">
              <line x1="160" y1="164" x2="54" y2="164" />
            </g>
            <circle className="launch-intro__hub" cx="160" cy="164" r="8" />
          </svg>
          <span className="launch-intro__gauge-label launch-intro__gauge-label--start">0</span>
          <span className="launch-intro__gauge-label launch-intro__gauge-label--middle">60</span>
          <span className="launch-intro__gauge-label launch-intro__gauge-label--end">MAX</span>
          <span className="launch-intro__gauge-status">READY</span>
        </div>
        <p className="launch-intro__caption">A little care goes a long way.</p>
        <button ref={skipRef} className="launch-intro__skip" type="button" onClick={close}>Skip intro</button>
      </div>
      <span className="launch-intro__sr-status" role="status" aria-live="polite">Loading Otofolks</span>
    </section>
  );
}
