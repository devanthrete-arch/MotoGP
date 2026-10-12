// A 3D model of the Ambassador, built from the six reference views (see scripts/ambassador-views.mjs):
//  - the side view gives the roof line (top of the shape along the length),
//  - the top view gives the width along the length,
//  - the rear view gives the cross-section: how the body narrows into the roof,
// and the views themselves are projected back onto the body, so doors, grille, lamps, bumpers and trim are the
// real drawn ones. Rendered as a clay model by default; `clay: false` shows the paint as drawn.
import * as THREE from "three";
import profile from "./ambassadorProfile.json";

type Prof = { w: number; h: number; shadowH: number; top?: number[]; half?: number[]; mid?: number[] };
const P = profile as unknown as Record<"side" | "sideR" | "top" | "front" | "rear", Prof>;

export const CAR_LENGTH = 4.3;
const L = CAR_LENGTH;
const sM = L / P.side.w;                       // metres per pixel of the side view
const ground = P.side.h - 1;                   // the row of the tyre bottoms
const roofH = ground * sM;                     // about 1.57 m
const sill = 0.27, belt = 1.02;

/** Where the wheels are, in metres (nose towards +x, ground at y = 0). */
export const wheels = {
  r: 54 * sM, cy: (ground - 205) * sM, z: 0.66, width: 0.19,
  front: (P.side.w / 2 - 116) * sM, rear: (P.side.w / 2 - 546) * sM,
};

const median = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const sample = (a: number[], f: number) => { const x = Math.min(a.length - 1, Math.max(0, f)); const i = Math.floor(x), j = Math.min(a.length - 1, i + 1), t = x - i; return a[i] * (1 - t) + a[j] * t; };
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Removes features narrower than `w` samples (the wing mirrors in the top view). */
function open(a: number[], w: number) {
  const min = a.map((_, i) => { let m = Infinity; for (let k = -w; k <= w; k++) m = Math.min(m, a[Math.min(a.length - 1, Math.max(0, i + k))]); return m; });
  return min.map((_, i) => { let m = 0; for (let k = -w; k <= w; k++) m = Math.max(m, min[Math.min(a.length - 1, Math.max(0, i + k))]); return m; });
}

const widthProfile = open(P.top.half!, 14);
const tM = L / P.top.w;
const rearScale = roofH / (P.rear.h - 1);
const rearBody = Math.max(...Array.from({ length: 60 }, (_, k) => sample(P.rear.half!, (roofH - (0.5 + k * 0.0075)) / rearScale)));

/** The body: a loft of cross-sections along the car. */
export function buildBodyGeometry(stations = 150, rows = 36) {
  const topH = Array.from({ length: stations }, (_, i) => (ground - sample(P.side.top!, (i / (stations - 1)) * (P.side.w - 1))) * sM);
  const smoothTop = topH.map((_, i) => { let s = 0, n = 0; for (let k = -2; k <= 2; k++) { s += topH[Math.min(stations - 1, Math.max(0, i + k))]; n += 1; } return s / n; });
  const pos: number[] = [], idx: number[] = [];
  const ring = rows * 2 - 1;
  const arch = (x: number) => {
    let y = sill;
    for (const xw of [wheels.front, wheels.rear]) { const dx = x - xw, ra = wheels.r + 0.07; if (Math.abs(dx) < ra) y = Math.max(y, wheels.cy + Math.sqrt(ra * ra - dx * dx)); }
    return y;
  };
  for (let i = 0; i < stations; i++) {
    const u = i / (stations - 1), x = L / 2 - u * L;
    const yTop = Math.max(sill + 0.12, smoothTop[i]), yBot = Math.min(arch(x), yTop - 0.08);
    const W = Math.min(0.84, sample(widthProfile, u * (P.top.w - 1)) * tM) * (0.12 + 0.88 * smoothstep(0, 0.012, u) * smoothstep(0, 0.012, 1 - u));
    const cab = smoothstep(belt, belt + 0.3, yTop);
    const rt = 0.13;
    const half: number[] = [], ys: number[] = [];
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), y = yBot + (yTop - yBot) * (1 - Math.pow(1 - t, 1.8));
      const round = y > yTop - rt ? Math.sqrt(Math.max(0, 1 - ((y - (yTop - rt)) / rt) ** 2)) : 1;
      const rw = y < 0.5 ? 1 : Math.min(1.02, sample(P.rear.half!, (roofH - y) / rearScale) / rearBody);
      half.push(W * ((1 - cab) + cab * rw) * round); ys.push(y);
    }
    for (let j = 0; j < rows; j++) pos.push(x, ys[j], half[j]);                                  // right side, bottom to top
    for (let j = rows - 2; j >= 0; j--) pos.push(x, ys[j], -half[j]);                            // left side, top to bottom
  }
  for (let i = 0; i < stations - 1; i++) for (let k = 0; k < ring; k++) {
    const a = i * ring + k, b = i * ring + ((k + 1) % ring), c = (i + 1) * ring + k, d = (i + 1) * ring + ((k + 1) % ring);
    idx.push(a, b, c, b, d, c);
  }
  // end caps
  for (const [station, flip] of [[0, true], [stations - 1, false]] as const) {
    const base = station * ring, cx = pos[base * 3], cyM = (pos[base * 3 + 1] + pos[(base + rows - 1) * 3 + 1]) / 2;
    const centre = pos.length / 3; pos.push(cx, cyM, 0);
    for (let k = 0; k < ring; k++) { const p = base + k, q = base + ((k + 1) % ring); if (flip) idx.push(centre, q, p); else idx.push(centre, p, q); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
const tex = (img: HTMLImageElement) => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t; };

/** A wheel face cut from a side view, as a texture; in clay tones when `clay`. */
function wheelFace(img: HTMLImageElement, cx: number, cy: number, r: number, clay: boolean) {
  const size = 256, c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, cx - r, cy - r, r * 2, r * 2, 0, 0, size, size);
  const d = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, dx = x - size / 2, dy = y - size / 2, inside = Math.hypot(dx, dy) < size / 2;
    if (clay) {
      const lum = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) / 255, k = 0.25 + 1.45 * Math.pow(lum, 0.7);
      d.data[i] = Math.min(255, 176 * k); d.data[i + 1] = Math.min(255, 106 * k); d.data[i + 2] = Math.min(255, 72 * k);
    }
    d.data[i + 3] = inside ? 255 : 0;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export type Ambassador = { group: THREE.Group; ready: Promise<void>; dispose: () => void };

/** The car, standing on y = 0, nose towards +x, centred on x = z = 0. */
export function createAmbassador({ clay = true, base = "/landing/ambassador/" }: { clay?: boolean; base?: string } = {}): Ambassador {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const body = buildBodyGeometry();
  disposables.push(body);

  const uniforms = {
    uReady: { value: 0 }, uClay: { value: clay ? 1 : 0 }, uClayColor: { value: new THREE.Color(0xb06a48) },
    tSideR: { value: null as THREE.Texture | null }, tSideL: { value: null as THREE.Texture | null }, tTop: { value: null as THREE.Texture | null },
    tFront: { value: null as THREE.Texture | null }, tRear: { value: null as THREE.Texture | null },
    // metres per pixel of each view, and the picture sizes: sideR, sideL, top, front, rear
    uK: { value: new THREE.Vector4(L / P.sideR.w, L / P.side.w, L / P.top.w, roofH / (P.front.h - 1)) },
    uRear: { value: new THREE.Vector4(roofH / (P.rear.h - 1), median(P.top.mid!), median(P.front.mid!), median(P.rear.mid!)) },
    uSizes: { value: new THREE.Vector4(P.sideR.w, P.sideR.shadowH, P.side.w, P.side.shadowH) },
    uSizes2: { value: new THREE.Vector4(P.top.w, P.top.shadowH, P.front.w, P.front.shadowH) },
    uSizes3: { value: new THREE.Vector4(P.rear.w, P.rear.shadowH, P.sideR.h, P.side.h) },
    uSizes4: { value: new THREE.Vector4(P.front.h, P.rear.h, P.top.h, 0) },
  };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, envMapIntensity: 0.32 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOP; varying vec3 vON;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOP = position; vON = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vOP; varying vec3 vON;
uniform float uReady, uClay; uniform vec3 uClayColor;
uniform sampler2D tSideR, tSideL, tTop, tFront, tRear;
uniform vec4 uK, uRear, uSizes, uSizes2, uSizes3, uSizes4;
const float LEN = ${L.toFixed(3)};
vec4 viewSideR(vec3 p) { vec2 uv = vec2((p.x + LEN * 0.5) / uK.x / uSizes.x, (p.y / uK.x + (uSizes.y - (uSizes3.z))) / uSizes.y); return texture2D(tSideR, uv); }
vec4 viewSideL(vec3 p) { vec2 uv = vec2((LEN * 0.5 - p.x) / uK.y / uSizes.z, (p.y / uK.y + (uSizes.w - (uSizes3.w))) / uSizes.w); return texture2D(tSideL, uv); }
vec4 viewTop(vec3 p) { float row = uRear.y - p.z / uK.z; vec2 uv = vec2((LEN * 0.5 - p.x) / uK.z / uSizes2.x, 1.0 - row / uSizes2.y); return texture2D(tTop, uv); }
vec4 viewFront(vec3 p) { float px = uRear.z - p.z / uK.w; vec2 uv = vec2(px / uSizes2.z, (p.y / uK.w + (uSizes2.w - uSizes4.x)) / uSizes2.w); return texture2D(tFront, uv); }
vec4 viewRear(vec3 p) { float px = uRear.w + p.z / uRear.x; vec2 uv = vec2(px / uSizes3.x, (p.y / uRear.x + (uSizes3.y - uSizes4.y)) / uSizes3.y); return texture2D(tRear, uv); }
`)
      .replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 n = normalize(vON); vec3 w = pow(abs(n), vec3(7.0)); w /= (w.x + w.y + w.z);
  vec4 c = vec4(0.0);
  vec4 sideC = n.z >= 0.0 ? viewSideR(vOP) : viewSideL(vOP);
  vec4 endC = n.x >= 0.0 ? viewFront(vOP) : viewRear(vOP);
  c = sideC * w.z + endC * w.x + viewTop(vOP) * w.y * step(0.0, n.y);
  float a = clamp(c.a / max(0.0001, (w.z + w.x + w.y * step(0.0, n.y))), 0.0, 1.0);
  vec3 col = c.rgb / max(0.0001, (w.z + w.x + w.y * step(0.0, n.y)));
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float mx = max(col.r, max(col.g, col.b)); float sat = mx > 0.0 ? (mx - min(col.r, min(col.g, col.b))) / mx : 0.0;
  float glass = step(1.0, vOP.y) * step(0.62, lum) * step(sat, 0.2);
  vec3 clayCol = uClayColor * (0.25 + 1.45 * pow(max(lum, 0.0), 0.7));
  clayCol = mix(clayCol, vec3(0.2, 0.115, 0.08), glass);
  vec3 photo = mix(col, vec3(0.04, 0.05, 0.07), glass);
  vec3 shown = mix(photo, clayCol, uClay);
  shown = mix(uClayColor * 0.55, shown, a * uReady);
  shown = mix(shown, uClayColor * 0.22, step(n.y, -0.5));
  diffuseColor.rgb = shown;
}`)
  };
  disposables.push(material);
  const mesh = new THREE.Mesh(body, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);

  const treadMat = new THREE.MeshStandardMaterial({ color: clay ? 0x4a2a1c : 0x111214, roughness: 0.85 });
  disposables.push(treadMat);
  const wheelParts: THREE.Mesh[] = [];
  const ready = (async () => {
    const [sideR, sideL, top, front, rear] = await Promise.all(["sideR", "side", "top", "front", "rear"].map((n) => load(`${base}${n}-render.webp`)));
    uniforms.tSideR.value = tex(sideR); uniforms.tSideL.value = tex(sideL); uniforms.tTop.value = tex(top);
    uniforms.tFront.value = tex(front); uniforms.tRear.value = tex(rear);
    Object.values(uniforms).forEach((u) => { const v = u.value as unknown; if (v instanceof THREE.Texture) disposables.push(v); });
    uniforms.uReady.value = 1;
    // wheel faces, cut from the drawn wheels
    const rPx = 56, faceR = wheelFace(sideR, sideR.naturalWidth - 116, 205, rPx, clay), faceL = wheelFace(sideL, 116, 205, rPx, clay);
    disposables.push(faceR, faceL);
    const faceMat = (t: THREE.Texture) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, envMapIntensity: 0.3 });
    const mR = faceMat(faceR), mL = faceMat(faceL); disposables.push(mR, mL);
    for (const x of [wheels.front, wheels.rear]) for (const side of [1, -1]) {
      const wg = new THREE.Group();
      const tread = new THREE.Mesh(new THREE.CylinderGeometry(wheels.r, wheels.r, wheels.width, 48, 1, true), treadMat);
      tread.rotation.x = Math.PI / 2; disposables.push(tread.geometry); wg.add(tread);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(wheels.r * 0.995, 64), side > 0 ? mR : mL);
      cap.position.z = side * wheels.width / 2 + side * 0.001; if (side < 0) cap.rotation.y = Math.PI;
      disposables.push(cap.geometry); wg.add(cap);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(wheels.r * 0.99, 48), treadMat);
      inner.position.z = -side * wheels.width / 2; if (side > 0) inner.rotation.y = Math.PI; disposables.push(inner.geometry); wg.add(inner);
      wg.position.set(x, wheels.cy, side * wheels.z);
      wg.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; wheelParts.push(o as THREE.Mesh); } });
      group.add(wg);
    }
  })();

  return { group, ready, dispose: () => disposables.forEach((d) => d.dispose()) };
}
