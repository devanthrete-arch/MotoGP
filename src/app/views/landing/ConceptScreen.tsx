// What the desktop display shows: the three-quarter view of the Ambassador drawn as a pencil sketch, then rendered
// in paint, again and again in new colours. It holds on the finished render when reduced motion is asked for.
import { useEffect, useState } from "react";
import { CarPair, paints } from "./carImages";

const rotation = [0, 5, 4, 7];
const drawMs = 2300, holdMs = 3200;

export function ConceptScreen() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"sketch" | "render">("sketch");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStage("render"); return; }
    setStage("sketch");
    const render = window.setTimeout(() => setStage("render"), drawMs);
    const next = window.setTimeout(() => setIndex((value) => (value + 1) % rotation.length), drawMs + holdMs);
    return () => { window.clearTimeout(render); window.clearTimeout(next); };
  }, [index]);
  const paint = rotation[index];
  return (
    <div className="lp-screen" data-stage={stage}>
      <div className="lp-screen__grid" aria-hidden="true" />
      <CarPair key={index} view="front34" paint={paint} revealed={stage === "render"} className="lp-screen__art" eager />
      <span className="lp-screen__tag" aria-hidden="true">Ambassador · {paints[paint].name}</span>
      <span className="lp-screen__bar" aria-hidden="true"><i /></span>
    </div>
  );
}
