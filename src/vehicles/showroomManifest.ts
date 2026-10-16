// What the virtual showroom shows: public/showroom/manifest.json, read and checked here.
// Adding a car is dropping a licensed GLB into public/showroom/ and adding an entry; see
// docs/SHOWROOM_MODELS.md for the fields and the licensing rules.

export type ShowroomCredit = { author: string; licence: string; url: string };

export type ShowroomCar = {
  id: string;
  name: string;
  maker: string;
  /** A GLB or glTF file on this site. Draco and meshopt compression are both understood. */
  src: string;
  /** A still picture of the car, shown when the browser cannot draw 3D. */
  poster: string;
  /** Names of the materials that make up the body paint; the colour swatches recolour these. */
  paintMaterials: string[];
  /** The car is scaled to this length so every model stands at true size. */
  lengthMetres: number;
  credit: ShowroomCredit;
  /** This car's own paints; the manifest's shared swatches when it lists none. */
  swatches: ShowroomSwatch[];
};

export type ShowroomSwatch = { name: string; hex: string };

export type ShowroomManifest = { cars: ShowroomCar[]; swatches: ShowroomSwatch[] };

export const showroomManifestUrl = "/showroom/manifest.json";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
// Only files on this site: a manifest entry can never make a visitor's browser fetch from elsewhere.
const sitePath = (value: unknown) => {
  const path = text(value);
  return path.startsWith("/") && !path.startsWith("//") ? path : "";
};
const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/** Keeps every well-formed car and swatch, drops the rest, and never throws. */
export function parseShowroomManifest(raw: unknown): ShowroomManifest {
  const source = (raw && typeof raw === "object" ? raw : {}) as { cars?: unknown; swatches?: unknown };
  const swatchList = (list: unknown) => (Array.isArray(list) ? list : []).flatMap((entry): ShowroomSwatch[] => {
    const swatch = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const hex = text(swatch.hex);
    return isHex(hex) ? [{ name: text(swatch.name) || hex, hex: hex.toLowerCase() }] : [];
  });
  const swatches = swatchList(source.swatches);
  const seen = new Set<string>();
  const cars = (Array.isArray(source.cars) ? source.cars : []).flatMap((entry): ShowroomCar[] => {
    const car = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = text(car.id);
    const src = sitePath(car.src);
    if (!id || !src || seen.has(id)) return [];
    seen.add(id);
    const credit = (car.credit && typeof car.credit === "object" ? car.credit : {}) as Record<string, unknown>;
    const url = text(credit.url);
    const length = Number(car.lengthMetres);
    return [{
      id,
      name: text(car.name) || id,
      maker: text(car.maker),
      src,
      poster: sitePath(car.poster),
      paintMaterials: (Array.isArray(car.paintMaterials) ? car.paintMaterials : []).map(text).filter(Boolean),
      lengthMetres: Number.isFinite(length) && length > 1 && length < 20 ? length : 4.2,
      credit: { author: text(credit.author), licence: text(credit.licence), url: /^https:\/\//.test(url) ? url : "" },
      swatches: swatchList(car.swatches).length ? swatchList(car.swatches) : swatches,
    }];
  });
  return { cars, swatches };
}

/** WebGL can be drawn here: checked once, before any 3D code is downloaded. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
