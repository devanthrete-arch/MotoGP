// The hero studio without WebGL: the same room as flat layers, with the concept drawn on the display. Used when
// the 3D scene cannot run (no WebGL), is not wanted (reduced motion, Save-Data) or when asked for by the tests.
import { CarImage } from "./carImages";
import { ConceptScreen } from "./ConceptScreen";

const ease = (t: number) => t * t * (3 - 2 * t);

export function StaticStudio({ progress }: { progress: number }) {
  const zoom = 1 + 2.9 * ease(progress);
  return (
    <div className="lp-static" aria-hidden="true">
      <div className="lp-static__zoom" style={{ transform: `scale(${zoom})`, transformOrigin: "50% 52%" }}>
        <div className="lp-static__wall" />
        <div className="lp-static__floor" />
        <div className="lp-static__car"><CarImage view="side" decorative eager /></div>
        <div className="lp-static__desk" />
        <div className="lp-static__monitor">
          <div className="lp-static__glass"><ConceptScreen /></div>
          <div className="lp-static__stand" />
        </div>
      </div>
    </div>
  );
}
