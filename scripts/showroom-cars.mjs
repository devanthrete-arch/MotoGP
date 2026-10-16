// Models the virtual showroom's cars from scratch: lofted bodies at each car's published length,
// width, height and wheelbase, with its own grille, lamps, wheels and trim. Stylised likenesses
// built here, not manufacturer files, and no badges or logos.
//   node scripts/showroom-cars.mjs
// Writes uncompressed GLBs to public/showroom/; compress each afterwards (Draco geometry):
//   npx @gltf-transform/cli draco public/showroom/<id>.glb public/showroom/<id>.glb
// The body paint material is named "Paint" so the showroom's swatches can recolour it.
// Axes: x runs rear (-) to front (+), y is up, z is across the car. Units are metres.
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// GLTFExporter reads its output Blob through FileReader, which Node does not have.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); }); }
};

const mat = {
  paint: new THREE.MeshPhysicalMaterial({ name: "Paint", color: "#c8102e", metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }),
  glass: new THREE.MeshPhysicalMaterial({ name: "Glass", color: "#080c0e", metalness: 0.1, roughness: 0.1, clearcoat: 0.5 }),
  trim: new THREE.MeshStandardMaterial({ name: "Trim", color: "#131516", roughness: 0.62 }),
  gloss: new THREE.MeshPhysicalMaterial({ name: "GlossBlack", color: "#050607", metalness: 0.2, roughness: 0.18, clearcoat: 1 }),
  chrome: new THREE.MeshStandardMaterial({ name: "Chrome", color: "#eef0f2", metalness: 0.9, roughness: 0.2 }),
  silver: new THREE.MeshStandardMaterial({ name: "Silver", color: "#a9aeb3", metalness: 0.8, roughness: 0.35 }),
  tyre: new THREE.MeshStandardMaterial({ name: "Tyre", color: "#121314", roughness: 0.92 }),
  rim: new THREE.MeshStandardMaterial({ name: "Rim", color: "#c3c7cb", metalness: 0.95, roughness: 0.24 }),
  rimDark: new THREE.MeshStandardMaterial({ name: "RimDark", color: "#2a2d30", metalness: 0.7, roughness: 0.35 }),
  disc: new THREE.MeshStandardMaterial({ name: "Disc", color: "#5d6165", metalness: 0.9, roughness: 0.45 }),
  lens: new THREE.MeshPhysicalMaterial({ name: "Headlamp", color: "#1c2126", metalness: 0.5, roughness: 0.06, clearcoat: 1 }),
  drl: new THREE.MeshStandardMaterial({ name: "DRL", color: "#ffffff", emissive: "#e9f1ff", emissiveIntensity: 2.2 }),
  tail: new THREE.MeshStandardMaterial({ name: "Taillamp", color: "#5c0910", emissive: "#ff1a2b", emissiveIntensity: 0.75 }),
  plate: new THREE.MeshStandardMaterial({ name: "Plate", color: "#c9cac6", roughness: 0.6 }),
};

// A smooth curve through [u, value] points that never overshoots them (monotone cubic).
function smooth(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const n = xs.length;
  const d = xs.slice(0, -1).map((x, k) => (ys[k + 1] - ys[k]) / (xs[k + 1] - x));
  const m = xs.map((_, k) => (k === 0 ? d[0] : k === n - 1 ? d[n - 2] : d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2));
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
    const a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
  };
}

// A body section swept along x: at each x a rounded-rectangle (superellipse) ring from bottom(x) to
// top(x), half-width half(x), narrowing towards the top by `taper`. Ends are closed flat.
/** One point of a loft's section at x, at angle th round it (0 = outboard side, π/2 = top). */
function sectionPoint({ bottom, top, half, n = 4, nTop = n, taper = 0 }, x, th) {
  const b = bottom(x), tp = Math.max(top(x), b + 0.002), zc = (b + tp) / 2, h = (tp - b) / 2, w = Math.max(half(x), 0.002);
  const c = Math.cos(th), s = Math.sin(th);
  const e = 2 / (s > 0 ? nTop : n);
  const yy = zc + Math.sign(s) * Math.abs(s) ** e * h;
  const zz = Math.sign(c) * Math.abs(c) ** e * w * (1 - taper * ((yy - b) / (tp - b)));
  return [x, yy, zz];
}

function loft(options) {
  const { x0, x1, steps = 160, ring = 48, reshape = (p) => p } = options;
  const pos = [];
  const idx = [];
  const section = (x) => {
    const out = [];
    for (let j = 0; j < ring; j++) out.push(reshape(sectionPoint(options, x, (j / ring) * Math.PI * 2)));
    return out;
  };
  const sections = [];
  for (let i = 0; i <= steps; i++) sections.push(section(x0 + ((x1 - x0) * i) / steps));
  for (const s of sections) for (const p of s) pos.push(...p);
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j, b = i * ring + ((j + 1) % ring), c = a + ring, d2 = b + ring;
      idx.push(a, c, b, b, c, d2);
    }
  }
  // Flat caps with their own vertices, so the end faces keep a crisp edge.
  for (const [s, flip, first] of [[sections[0], true, 0], [sections[steps], false, steps * ring]]) {
    const base = pos.length / 3;
    const cx = s.reduce((t, p) => t + p[0], 0) / ring;
    const cy = s.reduce((t, p) => t + p[1], 0) / ring;
    pos.push(cx, cy, 0);
    // Smooth caps reuse the last ring; otherwise the cap gets its own vertices and a crisp edge.
    const ringStart = options.smoothCaps ? first : base + 1;
    if (!options.smoothCaps) for (const p of s) pos.push(...p);
    for (let j = 0; j < ring; j++) {
      const a = ringStart + j, b = ringStart + ((j + 1) % ring);
      if (flip) idx.push(base, a, b); else idx.push(base, b, a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}

const mesh = (geometry, material, name) => Object.assign(new THREE.Mesh(geometry, material), { name: name ?? material.name });

/** A rounded box: length along x, height along y, width along z. */
function box(parent, [lx, hy, wz], [x, y, z], material, radius = 0.012) {
  const r = Math.min(radius, lx / 2.01, hy / 2.01, wz / 2.01);
  const m = mesh(new RoundedBoxGeometry(lx, hy, wz, 2, r), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** The same part on both sides of the car. */
function pair(parent, size, [x, y, z], material, radius) {
  box(parent, size, [x, y, z], material, radius);
  box(parent, size, [x, y, -z], material, radius);
}

function wheel(spec) {
  const { R, tyreWidth: tw, spokes, rimLook } = spec;
  const group = new THREE.Group();
  const rr = R * 0.72;
  // Tyre: a rounded section turned about the axle.
  const profile = [];
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI;
    profile.push(new THREE.Vector2(R - 0.035 + Math.cos(a) * 0.035, Math.sin(a) * (tw / 2)));
  }
  profile.unshift(new THREE.Vector2(rr, -tw / 2 + 0.01));
  profile.push(new THREE.Vector2(rr, tw / 2 - 0.01));
  const tyre = mesh(new THREE.LatheGeometry(profile, 56), mat.tyre);
  tyre.rotation.x = Math.PI / 2;
  group.add(tyre);
  const barrel = mesh(new THREE.CylinderGeometry(rr, rr, tw * 0.9, 48, 1, true), mat.rimDark);
  barrel.rotation.x = Math.PI / 2;
  group.add(barrel);
  const disc = mesh(new THREE.CylinderGeometry(rr * 0.78, rr * 0.78, 0.03, 32), mat.disc);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = tw * 0.12;
  group.add(disc);
  const lip = mesh(new THREE.TorusGeometry(rr * 0.97, 0.014, 8, 56), rimLook === "dark" ? mat.rimDark : mat.rim);
  lip.position.z = tw * 0.42;
  group.add(lip);
  const face = rimLook === "dark" ? mat.rimDark : mat.rim;
  for (let i = 0; i < spokes; i++) {
    const spoke = mesh(new RoundedBoxGeometry(rr * 0.94, spokes > 6 ? 0.03 : 0.055, 0.03, 2, 0.01), face);
    spoke.geometry.translate(rr * 0.47, 0, 0);
    spoke.rotation.z = (i / spokes) * Math.PI * 2;
    spoke.position.z = tw * 0.38;
    group.add(spoke);
    if (rimLook === "dual") {
      const cut = mesh(new RoundedBoxGeometry(rr * 0.6, 0.012, 0.032, 1, 0.004), mat.rim);
      cut.geometry.translate(rr * 0.6, 0, 0);
      cut.rotation.z = spoke.rotation.z;
      cut.position.z = tw * 0.4;
      group.add(cut);
    }
  }
  const hub = mesh(new THREE.CylinderGeometry(rr * 0.2, rr * 0.22, 0.05, 24), face);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = tw * 0.38;
  group.add(hub);
  return group;
}

function buildCar(spec) {
  const { L, W, R, gc, fo, wb, belt, nose, tail, roof, gFront, gRear, gHalf, gTaper } = spec;
  const car = new THREE.Group();
  const front = L / 2, rear = -L / 2;
  const axleF = front - fo, axleR = axleF - wb;
  const u = (x) => x / L;
  const archR = R + 0.045;
  const baseBottom = smooth([[-0.5, spec.rearBumperBottom], [-0.44, gc + 0.05], [-0.36, gc], [0.36, gc], [0.43, gc + 0.04], [0.5, spec.frontBumperBottom]]);
  // The arch opening eases into the sill over a few centimetres either side, instead of stepping,
  // which would crease the body side.
  const archLift = (x) => Math.max(...[axleF, axleR].map((a) => {
    const dx = Math.abs(x - a), ease = 0.07;
    if (dx < archR) return R + Math.sqrt(archR * archR - dx * dx);
    if (dx < archR + ease) { const t = (dx - archR) / ease; return R * (1 - t * t * (3 - 2 * t)) + baseBottom(u(x)) * t * t * (3 - 2 * t); }
    return 0;
  }));
  const bottom = (x) => Math.max(baseBottom(u(x)), archLift(x));
  const bodyTop = smooth(belt);
  const half = (x) => {
    // How far back from each end the body starts to narrow (the nose can taper into a V).
    const start = u(x) > 0 ? spec.noseStart ?? 0.38 : 0.38;
    const e = Math.max(0, Math.abs(u(x)) - start) / (0.5 - start);
    return (W / 2) * Math.sqrt(Math.max(0.05, 1 - e * e * (u(x) > 0 ? nose : tail)));
  };

  const smoothstep = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
  const beltFront = bodyTop(0.5), beltRear = bodyTop(-0.5);
  // The fascia leans back towards the bonnet and the tail leans forward, instead of standing flat;
  // a crease along the shoulder catches the light the way a pressed panel does.
  const reshapeBody = ([x, y, z]) => {
    const tFront = Math.min(1, Math.max(0, (y - spec.frontBumperBottom) / (beltFront - spec.frontBumperBottom)));
    const tRear = Math.min(1, Math.max(0, (y - spec.rearBumperBottom) / (beltRear - spec.rearBumperBottom)));
    const wFront = smoothstep((x - (front - 0.55)) / 0.55), wRear = smoothstep(((rear + 0.45) - x) / 0.45);
    const nx = x - spec.noseRake * tFront ** 1.2 * wFront - 0.06 * (1 - Math.min(1, tFront * 3)) ** 2 * wFront
      + spec.tailRake * tRear ** 1.2 * wRear + 0.05 * (1 - Math.min(1, tRear * 3)) ** 2 * wRear;
    const shoulder = bodyTop(u(x)) - (spec.shoulderDrop ?? 0.13);
    const nz = Math.abs(z) > 0.3 ? z * (1 + 0.016 * Math.exp(-(((y - shoulder) / 0.024) ** 2))) : z;
    return [nx, y, nz];
  };
  const body = mesh(loft({ x0: rear, x1: front, steps: 220, bottom, top: (x) => bodyTop(u(x)), half, n: 8, nTop: 10, taper: 0.07, reshape: reshapeBody, smoothCaps: true }), mat.paint, "Body");
  car.add(body);
  body.updateMatrixWorld();

  // Glasshouse, sunk into the body so the seam never shows.
  const roofLine = smooth(roof);
  const gHalfAt = (x) => Math.min(half(x) - 0.03, gHalf);
  car.add(mesh(loft({
    x0: gRear * L, x1: gFront * L, steps: 120,
    bottom: (x) => bodyTop(u(x)) - 0.08, top: (x) => roofLine(u(x)), half: gHalfAt, n: spec.glassN ?? 3.2, taper: gTaper,
  }), mat.glass, "Glasshouse"));


  const glassShape = { bottom: (x) => bodyTop(u(x)) - 0.08, top: (x) => roofLine(u(x)), half: gHalfAt, n: spec.glassN ?? 3.2, taper: gTaper };
  // Pillars follow the glasshouse's upper corner from the bonnet to the roof, and from the roof down
  // the rear glass, so the windows read as windows rather than one dark bubble.
  const pillar = (fromU, toU, radius, material) => {
    for (const side of [1, -1]) {
      const points = [];
      for (let i = 0; i <= 20; i++) {
        const [x, y, z] = sectionPoint(glassShape, (fromU + (toU - fromU) * (i / 20)) * L, side > 0 ? Math.PI / 4 : (3 * Math.PI) / 4);
        points.push(new THREE.Vector3(x, y, z * 1.01));
      }
      car.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, radius, 8), material, "Pillar"));
    }
  };

  // Roof panel in body colour over the cabin.
  const [rf, rr] = spec.roofPanel;
  const pillarPaint = spec.blackPillars ? mat.gloss : mat.paint;
  pillar(gFront - 0.004, rf + 0.01, 0.03, pillarPaint);
  pillar(rr - 0.01, gRear + 0.004, spec.rearPillarRadius ?? 0.045, spec.rearPillarPaint ? mat.paint : pillarPaint);
  // B-pillars: a dark band down the glass from the roof to the belt.
  for (const side of [1, -1]) {
    const bx = spec.bPillar * L;
    for (const dx of [-0.03, 0, 0.03]) {
      const points = [];
      for (let i = 0; i <= 10; i++) {
        const th = -0.35 + (Math.PI / 4 + 0.35) * (i / 10);
        const [x, y, z] = sectionPoint(glassShape, bx + dx, side > 0 ? th : Math.PI - th);
        points.push(new THREE.Vector3(x, y, z * 1.004 + side * 0.003));
      }
      car.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.02, 6), mat.gloss, "BPillar"));
    }
  }
  car.add(mesh(loft({
    x0: rr * L, x1: rf * L, steps: 80,
    bottom: (x) => roofLine(u(x)) - 0.085, top: (x) => roofLine(u(x)) + 0.014,
    half: (x) => gHalfAt(x) * (1 - gTaper) + 0.03, n: 3.5,
  }), spec.blackRoof ? mat.gloss : mat.paint, "Roof"));


  // Wheels.
  for (const side of [1, -1]) {
    for (const ax of [axleF, axleR]) {
      const w = wheel(spec);
      w.position.set(ax, R, side * (W / 2 - spec.tyreWidth / 2 - 0.035));
      if (side < 0) w.rotation.y = Math.PI;
      car.add(w);
    }
  }

  // Underbody, so nothing shows through from low angles.
  box(car, [L * 0.9, 0.05, W * 0.86], [0, gc + 0.04, 0], mat.trim, 0.02);
  // Wheel-arch liners.
  for (const ax of [axleF, axleR]) {
    // The upper half only: after the turn about x, angles from π/2 to 3π/2 face up.
    const liner = mesh(new THREE.CylinderGeometry(archR - 0.01, archR - 0.01, W * 0.86, 32, 1, true, Math.PI / 2, Math.PI), mat.trim);
    liner.material.side = THREE.DoubleSide;
    liner.rotation.x = Math.PI / 2;
    liner.position.set(ax, R, 0);
    car.add(liner);
  }

  // Cladding round the arches and along the sills on the SUVs.
  if (spec.cladding) {
    for (const side of [1, -1]) {
      for (const ax of [axleF, axleR]) {
        const arch = mesh(new THREE.TorusGeometry(archR + 0.02, 0.045, 10, 36, Math.PI), mat.trim);
        arch.scale.z = 0.6;
        arch.position.set(ax, R, side * (half(ax) - 0.03));
        car.add(arch);
      }
      box(car, [wb - archR * 2 - 0.04, 0.11, 0.05], [(axleF + axleR) / 2, gc + 0.1, side * (W / 2 - 0.03)], mat.trim, 0.02);
    }
  }

  // Door shut lines: thin dark seams traced down the body side from the belt to the sill.
  const sideRay = new THREE.Raycaster();
  const seam = (x, fromY, toY) => {
    for (const side of [1, -1]) {
      const points = [];
      for (let i = 0; i <= 14; i++) {
        const y = fromY + (toY - fromY) * (i / 14);
        sideRay.set(new THREE.Vector3(x, y, side * (W + 1)), new THREE.Vector3(0, 0, -side));
        const hit = sideRay.intersectObject(body)[0];
        if (hit) points.push(hit.point.clone().add(new THREE.Vector3(0, 0, side * 0.002)));
      }
      if (points.length > 3) car.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, 0.0045, 5), mat.gloss, "Seam"));
    }
  };
  const doorTop = (x) => bodyTop(u(x)) - 0.025;
  const frontDoor = gFront * L - 0.06, rearDoor = axleR + archR + 0.04;
  for (const x of [frontDoor, spec.bPillar * L + 0.05, rearDoor]) seam(x, doorTop(x), Math.max(bottom(x), gc) + 0.06);

  if (!spec.cladding) {
    for (const side of [1, -1]) {
      box(car, [wb - archR * 2 - 0.02, 0.07, 0.04], [(axleF + axleR) / 2, gc + 0.07, side * (W / 2 - 0.045)], mat.gloss, 0.02);
    }
  }

  // Mirrors, door handles and the belt line.
  const mx = gFront * L - 0.16;
  pair(car, [0.16, 0.11, 0.17], [mx, bodyTop(u(mx)) + 0.1, gHalfAt(mx) + 0.12], spec.blackMirrors ? mat.gloss : mat.paint, 0.04);
  pair(car, [0.05, 0.05, 0.07], [mx + 0.03, bodyTop(u(mx)) + 0.05, gHalfAt(mx) + 0.03], mat.trim, 0.01);
  for (const hx of spec.handles) {
    const x = hx * L;
    pair(car, [0.15, 0.025, 0.02], [x, bodyTop(u(x)) - 0.08, half(x) - 0.005], spec.chromeHandles ? mat.chrome : mat.paint, 0.01);
  }
  if (spec.chromeBelt) {
    const x0 = gRear * L + 0.12, x1 = gFront * L - 0.1;
    pair(car, [x1 - x0, 0.016, 0.02], [(x0 + x1) / 2, bodyTop(u((x0 + x1) / 2)) + 0.004, gHalf + 0.004], mat.chrome, 0.006);
  }

  if (spec.roofRails) {
    const r0 = spec.roofRails[0] * L, r1 = spec.roofRails[1] * L;
    for (const side of [1, -1]) {
      const z = side * (gHalfAt(0) * (1 - gTaper) - 0.02);
      const points = [];
      for (let i = 0; i <= 16; i++) { const x = r0 + (r1 - r0) * (i / 16); points.push(new THREE.Vector3(x, roofLine(u(x)) + 0.045, z)); }
      car.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.018, 8), spec.blackRails ? mat.gloss : mat.silver, "RoofRail"));
      for (const x of [r0 + 0.05, r1 - 0.05]) box(car, [0.08, 0.06, 0.04], [x, roofLine(u(x)) + 0.02, z], mat.trim, 0.01);
    }
  }

  // Face details are cast onto the body: each sits on the surface where a ray from straight ahead
  // (or behind) meets it, turned to the surface, so they follow the raked nose and wrap the corners.
  const raycaster = new THREE.Raycaster();
  const overlays = new Set([mat.drl, mat.chrome]);
  // Each part is a thin panel traced onto the body: a grid of rays from straight ahead (or behind)
  // finds the surface, so it follows the raked nose and wraps the corners without sinking in.
  // Corners are rounded as a superellipse; `lift` stacks overlays (chrome, light strips) on top.
  const place = ([, height, width], y, z, material, radius, outward, lift = 0) => {
    const rows = Math.max(4, Math.ceil(height / 0.012)), cols = Math.max(6, Math.ceil(width / 0.02));
    const roundness = Math.max(2.5, Math.min(12, Math.min(height, width) / Math.max(radius ?? 0.01, 0.002)));
    const offset = 0.004 + lift + (overlays.has(material) ? 0.004 : 0);
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const b = (r / rows) * 2 - 1;
      const span = (1 - Math.abs(b) ** roundness) ** (1 / roundness);
      const row = [];
      for (let c = 0; c <= cols; c++) {
        const a = ((c / cols) * 2 - 1) * span;
        raycaster.set(new THREE.Vector3(outward * (L / 2 + 1), y + (b * height) / 2, z + (a * width) / 2), new THREE.Vector3(-outward, 0, 0));
        const hit = raycaster.intersectObject(body)[0];
        row.push(hit ? hit.point.clone().addScaledVector(hit.face.normal.clone().normalize().multiplyScalar(Math.sign(hit.face.normal.x * outward) || 1), offset) : null);
      }
      grid.push(row);
    }
    const positions = [], index = [], ids = new Map();
    const id = (r, c) => {
      const key = r * (cols + 1) + c;
      if (!ids.has(key)) { ids.set(key, positions.length / 3); positions.push(grid[r][c].x, grid[r][c].y, grid[r][c].z); }
      return ids.get(key);
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const quad = [grid[r][c], grid[r][c + 1], grid[r + 1][c], grid[r + 1][c + 1]];
        if (quad.some((point) => !point)) continue;
        const [a, b, d, e] = [id(r, c), id(r, c + 1), id(r + 1, c), id(r + 1, c + 1)];
        if (outward > 0) index.push(a, d, b, b, d, e); else index.push(a, b, d, b, e, d);
      }
    }
    if (!index.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const part = mesh(geometry, material);
    car.add(part);
    return part;
  };
  const onFront = (size, h, z, material, radius, lift) => {
    // Headlamps a size up and a little higher than first drawn: they read better at showroom distance.
    if (material === mat.lens) { size = [size[0] + 0.03, size[1] * 1.45, size[2] * 1.35]; h += 0.035; }
    return place(size, spec.frontBumperBottom + h, z, material, radius, 1, lift);
  };
  const onRear = (size, h, z, material, radius, lift) => {
    // Tail lamps a size up as well, so they wrap round the corners like the real ones.
    if (material === mat.tail && size[2] < 0.5) size = [size[0] + 0.03, size[1] * 1.3, size[2] * 1.35];
    return place(size, spec.rearBumperBottom + h, z, material, radius, -1, lift);
  };
  spec.face({ onFront, onRear, frontPair: (size, h, z, m, r, lift) => { onFront(size, h, z, m, r, lift); onFront(size, h, -z, m, r, lift); },
    rearPair: (size, h, z, m, r, lift) => { onRear(size, h, z, m, r, lift); onRear(size, h, -z, m, r, lift); } });
  onFront([0.03, 0.11, 0.5], spec.plateFront, 0, mat.plate, 0.01, 0.006);
  onRear([0.03, 0.11, 0.5], spec.plateRear, 0, mat.plate, 0.01, 0.006);

  car.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  return car;
}

const slats = (onFront, count, { width, height, h, vertical, material = mat.silver }) => {
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1) - 0.5;
    if (vertical) onFront([0.04, height * 0.9, 0.016], h, f * width * 0.92, material, 0.006, 0.004);
    else onFront([0.04, 0.016, width * 0.94], h + f * height * 0.8, 0, material, 0.006, 0.004);
  }
};

const cars = [
  {
    id: "kia-sonet", noseRake: 0.08, tailRake: 0.05, name: "Kia Sonet", maker: "Kia · compact SUV",
    L: 3.995, W: 1.79, wb: 2.5, fo: 0.82, R: 0.335, tyreWidth: 0.215, gc: 0.205, spokes: 10, rimLook: "dual",
    frontBumperBottom: 0.34, rearBumperBottom: 0.48, nose: 0.42, tail: 0.3,
    // Belt kicks up into the rear quarter; the roof falls gently to a raked tailgate with a spoiler.
    belt: [[-0.5, 1.04], [-0.47, 1.12], [-0.4, 1.14], [-0.32, 1.12], [0.1, 1.07], [0.25, 1.04], [0.42, 1.0], [0.47, 0.97], [0.5, 0.9]],
    roof: [[-0.485, 1.12], [-0.465, 1.42], [-0.43, 1.55], [-0.25, 1.6], [0.0, 1.61], [0.08, 1.6], [0.28, 1.04]],
    gFront: 0.28, gRear: -0.485, gHalf: 0.84, gTaper: 0.13, glassN: 4.2, roofPanel: [0.075, -0.44], bPillar: -0.08,
    rearPillarRadius: 0.08, rearPillarPaint: true,
    blackPillars: true, blackMirrors: true, cladding: true, roofRails: [-0.42, 0.04], blackRails: true, handles: [0.0, -0.22],
    plateFront: 0.22, plateRear: 0.18,
    face({ onFront, onRear, frontPair, rearPair }) {
      // Tiger-nose grille across the upper face, a silver "smile" under it running out to the lamps.
      onFront([0.05, 0.18, 0.95], 0.4, 0, mat.gloss, 0.05);
      slats(onFront, 4, { width: 0.9, height: 0.16, h: 0.4, vertical: false, material: mat.silver });
      onFront([0.04, 0.028, 0.98], 0.3, 0, mat.silver, 0.012, 0.01);
      // Narrow lamps at the grille's outer ends, a light strip under each turning down the bumper corner.
      frontPair([0.06, 0.06, 0.22], 0.45, 0.6, mat.lens, 0.03);
      frontPair([0.04, 0.012, 0.26], 0.43, 0.6, mat.drl, 0.005);
      frontPair([0.04, 0.17, 0.014], 0.32, 0.64, mat.drl, 0.005);
      frontPair([0.04, 0.05, 0.05], 0.2, 0.62, mat.lens, 0.012);
      // Big lower grille in a silver skid-plate frame.
      onFront([0.05, 0.13, 0.9], 0.08, 0, mat.gloss, 0.03);
      slats(onFront, 3, { width: 0.86, height: 0.11, h: 0.08, vertical: false, material: mat.trim });
      onFront([0.045, 0.03, 0.96], 0.0, 0, mat.silver, 0.012, 0.01);
      frontPair([0.045, 0.16, 0.04], 0.08, 0.49, mat.silver, 0.012, 0.01);
      // Connected rear light bar.
      onRear([0.05, 0.03, 1.3], 0.42, 0, mat.tail, 0.01);
      rearPair([0.07, 0.11, 0.2], 0.4, 0.6, mat.tail, 0.03);
      onRear([0.05, 0.12, 1.2], 0.02, 0, mat.trim, 0.03);
      onRear([0.055, 0.035, 0.6], -0.02, 0, mat.silver, 0.012);
    },
    swatches: [["Intense Red", "#a3121c"], ["Glacier White Pearl", "#eceeee"], ["Imperial Blue", "#1d2f5c"], ["Aurora Black Pearl", "#121416"], ["Gravity Grey", "#4b5054"], ["Pewter Olive", "#5f6a52"]],
  },
  {
    id: "maruti-baleno", noseRake: 0.18, tailRake: 0.08, name: "Maruti Suzuki Baleno", maker: "Maruti Suzuki · hatchback",
    L: 3.99, W: 1.745, wb: 2.52, fo: 0.8, R: 0.305, tyreWidth: 0.195, gc: 0.17, spokes: 10, rimLook: "dual",
    frontBumperBottom: 0.24, rearBumperBottom: 0.36, noseStart: 0.32, nose: 0.62, tail: 0.38, shoulderDrop: 0.1,
    // Belt climbs from the bonnet to a kick at the rear quarter; long raked screen, roof arched over the B-pillar.
    belt: [[-0.5, 0.9], [-0.47, 1.0], [-0.4, 1.02], [-0.25, 0.99], [0.0, 0.94], [0.2, 0.9], [0.34, 0.86], [0.44, 0.8], [0.48, 0.76], [0.5, 0.72]],
    roof: [[-0.47, 1.0], [-0.44, 1.2], [-0.37, 1.36], [-0.22, 1.46], [-0.05, 1.5], [0.05, 1.49], [0.12, 1.44], [0.32, 0.87]],
    gFront: 0.32, gRear: -0.47, gHalf: 0.77, gTaper: 0.3, roofPanel: [0.07, -0.36], bPillar: -0.07, rearPillarRadius: 0.07, rearPillarPaint: true,
    blackPillars: false, blackMirrors: false, handles: [0.02, -0.2], chromeHandles: true,
    plateFront: 0.08, plateRear: 0.13,
    face({ onFront, onRear, frontPair, rearPair }) {
      // Wide grille under the bonnet's leading edge, two chrome bars across it, the upper one running into the lamps.
      onFront([0.05, 0.17, 0.9], 0.25, 0, mat.gloss, 0.06);
      onFront([0.04, 0.018, 1.02], 0.315, 0, mat.chrome, 0.008);
      onFront([0.04, 0.014, 0.84], 0.255, 0, mat.chrome, 0.006);
      // Swept headlamps tucked under the bonnet line, wrapping into the wings, with the three-part light strip.
      frontPair([0.06, 0.07, 0.24], 0.36, 0.5, mat.lens, 0.03);
      frontPair([0.06, 0.06, 0.12], 0.37, 0.64, mat.lens, 0.03);
      for (const dz of [0.4, 0.5, 0.6]) frontPair([0.04, 0.012, 0.07], 0.35, dz, mat.drl, 0.004);
      // Black lower intake, fog-lamp pods at the corners with a chrome flick above each.
      onFront([0.05, 0.08, 1.0], 0.03, 0, mat.trim, 0.03);
      frontPair([0.05, 0.13, 0.12], 0.08, 0.6, mat.trim, 0.03);
      frontPair([0.04, 0.035, 0.05], 0.08, 0.6, mat.drl, 0.017);
      frontPair([0.04, 0.014, 0.14], 0.16, 0.56, mat.chrome, 0.006);
      rearPair([0.08, 0.13, 0.26], 0.42, 0.56, mat.tail, 0.04);
      onRear([0.05, 0.02, 0.72], 0.38, 0, mat.chrome, 0.008);
      onRear([0.05, 0.08, 1.1], 0.0, 0, mat.trim, 0.03);
    },
    swatches: [["Nexa Blue", "#1f3f8c"], ["Opulent Red", "#8f141c"], ["Arctic White", "#f0f1ef"], ["Grandeur Grey", "#55595d"], ["Splendid Silver", "#b7bbbe"], ["Luxe Beige", "#a8957a"]],
  },
  {
    id: "vw-virtus", noseRake: 0.13, tailRake: 0.1, name: "Volkswagen Virtus", maker: "Volkswagen · sedan",
    L: 4.561, W: 1.752, wb: 2.651, fo: 0.88, R: 0.32, tyreWidth: 0.205, gc: 0.179, spokes: 5, rimLook: "dual",
    frontBumperBottom: 0.25, rearBumperBottom: 0.38, noseStart: 0.33, nose: 0.6, tail: 0.45, shoulderDrop: 0.11,
    // Long flat bonnet, steeply raked screen, the roof arcing down a fast rear glass to a short, high boot.
    belt: [[-0.5, 0.94], [-0.45, 1.0], [-0.36, 1.01], [-0.25, 0.99], [0.0, 0.95], [0.2, 0.91], [0.36, 0.86], [0.44, 0.81], [0.48, 0.77], [0.5, 0.74]],
    roof: [[-0.335, 1.0], [-0.24, 1.3], [-0.14, 1.44], [-0.02, 1.5], [0.08, 1.48], [0.14, 1.42], [0.28, 0.9]],
    gFront: 0.28, gRear: -0.335, gHalf: 0.76, gTaper: 0.3, roofPanel: [0.1, -0.13], bPillar: -0.03,
    rearPillarRadius: 0.06, rearPillarPaint: true,
    blackPillars: false, handles: [0.06, -0.13], chromeHandles: true, chromeBelt: true,
    plateFront: 0.27, plateRear: 0.2,
    face({ onFront, onRear, frontPair, rearPair }) {
      // Slim gloss grille with a chrome bar running lamp to lamp, a second fine line under it.
      onFront([0.05, 0.07, 0.62], 0.38, 0, mat.gloss, 0.03);
      onFront([0.04, 0.014, 1.22], 0.4, 0, mat.chrome, 0.006);
      onFront([0.04, 0.01, 0.6], 0.35, 0, mat.chrome, 0.004);
      frontPair([0.06, 0.065, 0.28], 0.37, 0.5, mat.lens, 0.03);
      frontPair([0.04, 0.01, 0.3], 0.355, 0.5, mat.drl, 0.004);
      // Wide lower intake with chrome lines on its flanks and fog lamps in the corners.
      onFront([0.05, 0.16, 1.0], 0.11, 0, mat.gloss, 0.04);
      slats(onFront, 3, { width: 0.96, height: 0.14, h: 0.11, vertical: false, material: mat.trim });
      for (const dh of [0.09, 0.13, 0.17]) frontPair([0.04, 0.01, 0.16], dh, 0.45, mat.chrome, 0.004, 0.01);
      frontPair([0.05, 0.09, 0.1], 0.11, 0.62, mat.trim, 0.03);
      frontPair([0.04, 0.04, 0.06], 0.11, 0.62, mat.drl, 0.018);
      // Split tail lamps across the boot lid, with a chrome strip between.
      rearPair([0.08, 0.1, 0.34], 0.46, 0.5, mat.tail, 0.035);
      onRear([0.05, 0.016, 0.62], 0.46, 0, mat.chrome, 0.006);
      onRear([0.05, 0.07, 1.2], 0.02, 0, mat.trim, 0.025);
      onRear([0.055, 0.015, 0.8], 0.06, 0, mat.chrome, 0.006);
    },
    swatches: [["Wild Cherry Red", "#8c1020"], ["Candy White", "#f3f3f1"], ["Rising Blue", "#2c4f8f"], ["Curcuma Yellow", "#d9a514"], ["Reflex Silver", "#b5b9bc"], ["Carbon Steel Grey", "#4d5155"]],
  },
  {
    id: "honda-amaze", noseRake: 0.07, tailRake: 0.1, name: "Honda Amaze", maker: "Honda · compact sedan",
    L: 3.995, W: 1.733, wb: 2.47, fo: 0.8, R: 0.305, tyreWidth: 0.185, gc: 0.172, spokes: 12, rimLook: "dual",
    frontBumperBottom: 0.25, rearBumperBottom: 0.38, noseStart: 0.34, nose: 0.5, tail: 0.42, shoulderDrop: 0.1,
    // A tall, fairly upright nose; the roof arcs over to a raked rear glass and a short boot.
    belt: [[-0.5, 0.92], [-0.45, 0.99], [-0.37, 1.0], [-0.24, 0.98], [0.0, 0.95], [0.22, 0.92], [0.38, 0.88], [0.46, 0.84], [0.5, 0.78]],
    roof: [[-0.335, 0.98], [-0.24, 1.3], [-0.13, 1.45], [0.0, 1.5], [0.09, 1.48], [0.15, 1.42], [0.28, 0.92]],
    gFront: 0.28, gRear: -0.335, gHalf: 0.76, gTaper: 0.3, roofPanel: [0.1, -0.14], bPillar: -0.04,
    rearPillarRadius: 0.06, rearPillarPaint: true,
    blackPillars: true, handles: [0.06, -0.15], chromeHandles: true,
    plateFront: 0.12, plateRear: 0.18,
    face({ onFront, onRear, frontPair, rearPair }) {
      // Big octagonal grille in a diamond mesh, under a thick chrome bar that runs into the lamps.
      onFront([0.05, 0.25, 0.64], 0.24, 0, mat.gloss, 0.07);
      slats(onFront, 6, { width: 0.6, height: 0.22, h: 0.24, vertical: false, material: mat.trim });
      slats(onFront, 11, { width: 0.6, height: 0.22, h: 0.24, vertical: true, material: mat.trim });
      onFront([0.04, 0.03, 1.0], 0.385, 0, mat.chrome, 0.012);
      // Slim headlamps beside the bar, LED strip along their top edge.
      frontPair([0.06, 0.055, 0.26], 0.37, 0.53, mat.lens, 0.025);
      frontPair([0.04, 0.01, 0.3], 0.425, 0.53, mat.drl, 0.004);
      // Black corner intakes with fog lamps, and a black lip.
      frontPair([0.05, 0.15, 0.1], 0.12, 0.6, mat.gloss, 0.03);
      frontPair([0.04, 0.03, 0.06], 0.11, 0.6, mat.drl, 0.012);
      onFront([0.05, 0.05, 0.8], 0.02, 0, mat.trim, 0.02);
      // C-shaped tail lamps and a chrome strip across the boot.
      rearPair([0.08, 0.13, 0.3], 0.44, 0.53, mat.tail, 0.04);
      rearPair([0.085, 0.04, 0.16], 0.44, 0.5, mat.lens, 0.015);
      onRear([0.05, 0.02, 0.7], 0.47, 0, mat.chrome, 0.008);
      onRear([0.05, 0.07, 1.1], 0.02, 0, mat.trim, 0.025);
    },
    swatches: [["Radiant Red", "#9a1420"], ["Platinum White Pearl", "#eeeeea"], ["Obsidian Blue Pearl", "#1d2a44"], ["Meteoroid Grey", "#55585b"], ["Lunar Silver", "#b4b7ba"], ["Golden Brown", "#6e5a43"]],
  },
  {
    id: "honda-elevate", noseRake: 0.05, tailRake: 0.04, name: "Honda Elevate", maker: "Honda · SUV",
    L: 4.312, W: 1.79, wb: 2.65, fo: 0.87, R: 0.345, tyreWidth: 0.215, gc: 0.22, spokes: 16, rimLook: "dual",
    frontBumperBottom: 0.32, rearBumperBottom: 0.5, nose: 0.36, tail: 0.3,
    // Flat, high bonnet and an upright face; black roof over black pillars.
    belt: [[-0.5, 1.06], [-0.47, 1.14], [-0.4, 1.15], [0.1, 1.11], [0.25, 1.09], [0.42, 1.05], [0.47, 1.02], [0.5, 0.96]],
    roof: [[-0.486, 1.1], [-0.465, 1.5], [-0.43, 1.59], [0.0, 1.62], [0.08, 1.61], [0.27, 1.03]],
    gFront: 0.27, gRear: -0.486, gHalf: 0.84, gTaper: 0.13, glassN: 4.2, roofPanel: [0.075, -0.45], bPillar: -0.08,
    rearPillarRadius: 0.07, rearPillarPaint: true, blackRoof: true,
    blackPillars: true, blackMirrors: true, cladding: true, roofRails: [-0.42, 0.05], handles: [0.0, -0.22], chromeHandles: true,
    plateFront: 0.16, plateRear: 0.2,
    face({ onFront, onRear, frontPair, rearPair }) {
      // Huge upright grille with dashed horizontal bars, a thick chrome bar across the top.
      onFront([0.05, 0.34, 0.9], 0.36, 0, mat.gloss, 0.07);
      slats(onFront, 8, { width: 0.86, height: 0.31, h: 0.36, vertical: false, material: mat.trim });
      onFront([0.04, 0.03, 1.12], 0.56, 0, mat.chrome, 0.012);
      // Slim lamps tucked under the chrome bar, wrapping round the corners.
      frontPair([0.06, 0.05, 0.26], 0.49, 0.62, mat.lens, 0.025);
      frontPair([0.04, 0.01, 0.3], 0.545, 0.6, mat.drl, 0.004);
      // Black triangular corner intakes with fog lamps, wide lower grille, silver skid plate.
      frontPair([0.05, 0.17, 0.14], 0.24, 0.64, mat.gloss, 0.03);
      frontPair([0.04, 0.04, 0.05], 0.22, 0.64, mat.drl, 0.018);
      onFront([0.05, 0.07, 0.92], 0.06, 0, mat.gloss, 0.03);
      onFront([0.045, 0.035, 1.0], 0.0, 0, mat.silver, 0.012, 0.01);
      // Light bar across the tailgate.
      onRear([0.05, 0.035, 1.2], 0.5, 0, mat.tail, 0.012);
      rearPair([0.07, 0.11, 0.24], 0.48, 0.6, mat.tail, 0.035);
      onRear([0.05, 0.12, 1.2], 0.02, 0, mat.trim, 0.03);
      onRear([0.055, 0.035, 0.6], -0.01, 0, mat.silver, 0.012);
    },
    swatches: [["Phoenix Orange Pearl", "#c4561d"], ["Platinum White Pearl", "#eeeeea"], ["Obsidian Blue Pearl", "#1d2a44"], ["Golden Brown", "#6e5a43"], ["Meteoroid Grey", "#55585b"], ["Crystal Black Pearl", "#111214"]],
  },
  {
    id: "mahindra-xuv700", noseRake: 0.08, tailRake: 0.05, name: "Mahindra XUV700", maker: "Mahindra · SUV",
    L: 4.695, W: 1.89, wb: 2.75, fo: 0.95, R: 0.37, tyreWidth: 0.235, gc: 0.2, spokes: 10, rimLook: "dual",
    frontBumperBottom: 0.34, rearBumperBottom: 0.52, nose: 0.36, tail: 0.32,
    // Long and tall; the roof falls slightly to the tailgate over a black, "floating" rear pillar.
    belt: [[-0.5, 1.1], [-0.47, 1.18], [-0.4, 1.19], [0.1, 1.15], [0.25, 1.13], [0.42, 1.08], [0.47, 1.05], [0.5, 0.99]],
    roof: [[-0.486, 1.16], [-0.465, 1.56], [-0.43, 1.66], [-0.2, 1.71], [0.0, 1.72], [0.08, 1.71], [0.26, 1.07]],
    gFront: 0.26, gRear: -0.486, gHalf: 0.89, gTaper: 0.13, glassN: 4.2, roofPanel: [0.075, -0.45], bPillar: -0.06,
    rearPillarRadius: 0.07,
    blackPillars: true, blackMirrors: true, cladding: true, roofRails: [-0.42, 0.05], handles: [0.02, -0.2], chromeHandles: true, chromeBelt: true,
    plateFront: 0.16, plateRear: 0.22,
    face({ onFront, onRear, frontPair, rearPair }) {
      // Large grille full of vertical chrome slats.
      onFront([0.05, 0.3, 0.86], 0.36, 0, mat.gloss, 0.05);
      slats(onFront, 13, { width: 0.82, height: 0.27, h: 0.36, vertical: true });
      // Angular lamps at the grille's top corners; the "dagger" lights drop from them down the bumper.
      frontPair([0.06, 0.06, 0.26], 0.47, 0.6, mat.lens, 0.02);
      frontPair([0.04, 0.01, 0.26], 0.46, 0.62, mat.drl, 0.004);
      frontPair([0.04, 0.32, 0.016], 0.28, 0.72, mat.drl, 0.006);
      frontPair([0.04, 0.016, 0.08], 0.12, 0.69, mat.drl, 0.006);
      // Wide lower bumper: black intake, fog lamps, silver skid plate.
      onFront([0.05, 0.1, 1.0], 0.08, 0, mat.gloss, 0.03);
      frontPair([0.04, 0.03, 0.06], 0.1, 0.6, mat.drl, 0.012);
      onFront([0.045, 0.03, 0.8], 0.0, 0, mat.silver, 0.012, 0.01);
      rearPair([0.08, 0.16, 0.24], 0.5, 0.66, mat.tail, 0.04);
      onRear([0.05, 0.02, 1.0], 0.55, 0, mat.chrome, 0.008);
      onRear([0.05, 0.13, 1.3], 0.02, 0, mat.trim, 0.03);
      onRear([0.055, 0.035, 0.7], -0.01, 0, mat.silver, 0.012);
    },
    swatches: [["Red Rage", "#9b1119"], ["Everest White", "#f0f0ee"], ["Midnight Black", "#0f1012"], ["Electric Blue", "#1f4f9e"], ["Dazzling Silver", "#b3b7ba"], ["Deep Forest", "#22342b"]],
  },
];

const exporter = new GLTFExporter();
const manifest = { cars: [], swatches: [] };
for (const spec of cars) {
  const scene = buildCar(spec);
  scene.name = spec.id;
  const glb = await exporter.parseAsync(scene, { binary: true });
  writeFileSync(`public/showroom/${spec.id}.glb`, Buffer.from(glb));
  console.log(`public/showroom/${spec.id}.glb`, glb.byteLength, "bytes");
  manifest.cars.push({
    id: spec.id, name: spec.name, maker: spec.maker, src: `/showroom/${spec.id}.glb`, poster: `/showroom/${spec.id}.jpg`,
    paintMaterials: ["Paint"], lengthMetres: spec.L,
    credit: { author: "Otofolks", licence: "Modelled from scratch · stylised likeness, not a manufacturer model", url: "" },
    swatches: spec.swatches.map(([name, hex]) => ({ name, hex })),
  });
}
manifest.swatches = manifest.cars[0].swatches;
writeFileSync("public/showroom/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
