// The Ambassador as pictures: the reference views, each as a render (green paint, transparent background) and as a
// pencil sketch (black ink, transparent). Other paints are made in the browser from the green render: only the
// paint's own pixels change colour, so chrome, glass and the whitewall tyres stay as drawn.
import { useEffect, useState, type CSSProperties } from "react";
import sizes from "./ambassadorViews.json";

export type CarView = "front" | "rear" | "top" | "side" | "sideR" | "front34" | "rear34";
const base = "/landing/ambassador/";
const names: Record<CarView, string> = {
  front: "front", rear: "rear", top: "seen from above", side: "left side", sideR: "right side", front34: "three-quarter front", rear34: "three-quarter rear",
};

/** `h` is the hue to paint in; the other numbers reshape the green paint's saturation and lightness. */
export const paints = [
  { name: "Brunswick green", value: "#1f4a2c", h: 0, sMul: 1, lMul: 1, lAdd: 0 },
  { name: "Ivory", value: "#e9e4d6", h: 42, sMul: 0.28, lMul: 1.5, lAdd: 0.52 },
  { name: "Taxi yellow", value: "#f2b705", h: 46, sMul: 2, lMul: 1.55, lAdd: 0.2 },
  { name: "Maroon", value: "#7b1f2c", h: 350, sMul: 1.05, lMul: 1.05, lAdd: 0.03 },
  { name: "Racing blue", value: "#2c56d6", h: 222, sMul: 1.6, lMul: 1.4, lAdd: 0.1 },
  { name: "Copper", value: "#c46f2c", h: 24, sMul: 1.7, lMul: 1.5, lAdd: 0.15 },
  { name: "Graphite", value: "#4a4f58", h: 215, sMul: 0.14, lMul: 1.4, lAdd: 0.1 },
  { name: "Signal red", value: "#d3202b", h: 357, sMul: 2, lMul: 1.4, lAdd: 0.1 },
] as const;

const cache = new Map<string, Promise<string>>();
const hslOf = (r: number, g: number, b: number) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s, l];
};
const rgbOf = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};
/** The render repainted: pixels that are green and saturated take the new paint, everything else is left alone. */
function repaint(src: string, paint: (typeof paints)[number]): Promise<string> {
  const key = `${src}|${paint.name}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
          if (d.data[i + 3] < 8) continue;
          const [h, s, l] = hslOf(d.data[i] / 255, d.data[i + 1] / 255, d.data[i + 2] / 255);
          if (h < 60 || h > 200 || s < 0.06 || l > 0.85) continue;
          const weight = Math.min(1, (s - 0.06) / 0.16);                     // soft edge between paint and everything else
          const [r2, g2, b2] = rgbOf(paint.h, Math.min(1, s * paint.sMul), Math.min(0.97, l * paint.lMul + paint.lAdd));
          d.data[i] = d.data[i] * (1 - weight) + r2 * weight; d.data[i + 1] = d.data[i + 1] * (1 - weight) + g2 * weight; d.data[i + 2] = d.data[i + 2] * (1 - weight) + b2 * weight;
        }
        g.putImageData(d, 0, 0);
        c.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("paint"))), "image/png");
      };
      img.onerror = () => reject(new Error(src));
      img.src = src;
    });
    cache.set(key, hit);
  }
  return hit;
}

/** The address of a render in the given paint: the file itself for the green, a repainted copy for the rest. */
function usePaintedSrc(src: string, paintIndex: number) {
  const [url, setUrl] = useState<string | null>(paintIndex === 0 ? src : null);
  useEffect(() => {
    if (paintIndex === 0) { setUrl(src); return; }
    let live = true;
    repaint(src, paints[paintIndex]).then((u) => { if (live) setUrl(u); }, () => { if (live) setUrl(src); });
    return () => { live = false; };
  }, [src, paintIndex]);
  return url;
}

const size = (view: CarView, kind: "render" | "sketch") => {
  const s = sizes[view];
  return kind === "render" ? { w: s.w, h: s.shadowH } : { w: s.sketchW, h: s.sketchH };
};

type ImgProps = { view: CarView; kind?: "render" | "sketch"; paint?: number; className?: string; style?: CSSProperties; label?: string; decorative?: boolean; eager?: boolean };

/** One picture of the car. A render can be recoloured by paint index. */
export function CarImage({ view, kind = "render", paint = 0, className, style, label, decorative, eager }: ImgProps) {
  const { w, h } = size(view, kind);
  const file = `${base}${view}-${kind}.webp`;
  const src = usePaintedSrc(file, kind === "render" ? paint : 0);
  return (
    <img className={`lp-car${className ? ` ${className}` : ""}`} src={src ?? undefined} width={w} height={h} loading={eager ? "eager" : "lazy"} decoding="async"
      alt={decorative ? "" : label ?? `Classic Indian saloon, ${names[view]}, ${kind === "render" ? `${paints[paint].name} studio render` : "pencil sketch"}, an original drawing`}
      style={{ aspectRatio: `${w} / ${h}`, ...(src ? null : { visibility: "hidden" as const }), ...style }} />
  );
}

/** A sketch and its render stacked in one box, so the render can be wiped over the sketch. */
export function CarPair({ view, paint = 0, revealed, className, decorative, eager, label }: { view: CarView; paint?: number; revealed?: boolean; className?: string; decorative?: boolean; eager?: boolean; label?: string }) {
  const r = size(view, "render");
  return (
    <div className={`lp-pair${className ? ` ${className}` : ""}`} style={{ aspectRatio: `${r.w} / ${r.h}` }} data-revealed={revealed}>
      <CarImage view={view} kind="sketch" className="lp-pair__s" decorative eager={eager} />
      <CarImage view={view} kind="render" paint={paint} className="lp-pair__r" decorative={decorative} label={label} eager={eager} />
    </div>
  );
}
