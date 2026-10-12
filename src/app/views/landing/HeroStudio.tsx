// The first screen: the design studio, the floating navigation, "Make it real" and the two actions. The studio
// is a rendered picture when public/landing/hero-studio.jpg exists, and a real-time 3D scene until then. On
// scroll the camera pushes into the desktop display, which is where the concept is drawn.
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ConceptScreen } from "./ConceptScreen";
import { heroImage } from "./heroConfig";
import { StaticStudio } from "./StaticStudio";
import type { ScreenRect } from "./HeroScene";

const HeroScene = lazy(() => import("./HeroScene"));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);

type Mode = "checking" | "image" | "scene" | "static";

/** The 3D studio needs WebGL and a visitor who has not asked for less: reduced motion, Save-Data, or the flag the tests set. */
function canRunScene() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false;
    if (window.sessionStorage.getItem("otofolks.hero") === "static") return false;
    const probe = document.createElement("canvas");
    return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch { return false; }
}

/** Past this much of the scroll the camera is on the display and the hero is done. */
const done = 0.97;

export function HeroStudio({ children, onComplete }: { children: (progress: number) => React.ReactNode; onComplete?: () => void }) {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const activeRef = useRef(true);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<Mode>("checking");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [monitor, setMonitor] = useState<ScreenRect | null>(null);

  // Is there a studio picture to use?
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setMode("image");
    img.onerror = () => live && setMode(canRunScene() ? "scene" : "static");
    img.src = heroImage.src;
    return () => { live = false; };
  }, []);

  // Scroll progress through the pinned hero.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let raf = 0, lastY = window.scrollY, lastP = 0, fired = false;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const p = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight), 0, 1);
      progressRef.current = p;
      activeRef.current = rect.bottom > -50 && rect.top < window.innerHeight;
      setProgress((old) => (Math.abs(old - p) > 0.002 ? p : old));
      // Reaching the end by scrolling down hands over to sign-in. A jump (a link, a restored position, a test) does not.
      const step = window.scrollY - lastY;
      if (p < 0.8) fired = false;
      if (!fired && p >= done && lastP < done && step > 0 && step < window.innerHeight * 1.1) { fired = true; completeRef.current?.(); }
      lastY = window.scrollY; lastP = p;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const el = pin.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMonitor = useCallback((r: ScreenRect) => setMonitor(r), []);

  // With a picture, work out where its monitor lands once the picture is scaled to cover the screen.
  let imageLayout: { style: CSSProperties; rect: ScreenRect; zoom: number; origin: string } | null = null;
  if (mode === "image" && size.w > 0) {
    const scale = Math.max(size.w / heroImage.width, size.h / heroImage.height);
    const w = heroImage.width * scale, h = heroImage.height * scale;
    const left = (size.w - w) / 2, top = (size.h - h) / 2;
    const m = heroImage.monitor;
    const rect = { x: left + m.x * w, y: top + m.y * h, w: m.w * w, h: m.h * h };
    const target = Math.min(3.8, (size.w * 1.04) / rect.w);
    const zoom = 1 + (target - 1) * ease(progress);
    imageLayout = { style: { left, top, width: w, height: h }, rect, zoom, origin: `${rect.x + rect.w / 2}px ${rect.y + rect.h / 2}px` };
  }
  const screenRect = mode === "image" ? imageLayout?.rect ?? null : monitor;

  return (
    <section ref={section} className="lp-hero" aria-label="Studio">
      <div ref={pin} className="lp-hero__pin" data-mode={mode}>
        {mode === "image" && imageLayout && (
          <div className="lp-hero__zoom" style={{ transform: `scale(${imageLayout.zoom})`, transformOrigin: imageLayout.origin }}>
            <img className="lp-hero__image" src={heroImage.src} alt="" style={imageLayout.style} />
            {screenRect && <div className="lp-hero__glass" style={{ left: screenRect.x, top: screenRect.y, width: screenRect.w, height: screenRect.h }}><ConceptScreen /></div>}
          </div>
        )}
        {mode === "scene" && (
          <>
            <Suspense fallback={null}>
              <HeroScene progressRef={progressRef} activeRef={activeRef} onMonitor={onMonitor} />
            </Suspense>
            {screenRect && <div className="lp-hero__glass" style={{ left: screenRect.x, top: screenRect.y, width: screenRect.w, height: screenRect.h }}><ConceptScreen /></div>}
          </>
        )}
        {mode === "static" && <StaticStudio progress={progress} />}
        {mode === "checking" && <div className="lp-hero__blank" />}
        <div className="lp-hero__grain" aria-hidden="true" />
        <div className="lp-hero__content" style={{ opacity: 1 - clamp(progress / 0.28, 0, 1) }}>{children(progress)}</div>
      </div>
    </section>
  );
}
