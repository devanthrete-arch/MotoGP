// The hero studio, built in real time: a clay model of a classic Indian saloon on a turntable, a dark wooden
// workstation with a monitor, a lamp, a chair, a 3D scanner and a robot arm. It is the stand-in until a
// rendered studio picture is dropped into public/landing (see heroConfig.ts). Procedural geometry, soft
// shadows, a glossy floor. The monitor is left blank here: the page draws the sketch-to-render on it.
import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createAmbassador } from "./ambassadorModel";

export type ScreenRect = { x: number; y: number; w: number; h: number };
type Props = {
  /** 0 at the top of the page, 1 when the camera has pushed into the monitor. */
  progressRef: MutableRefObject<number>;
  /** Called when the monitor moves on the canvas, in CSS pixels. */
  onMonitor: (rect: ScreenRect) => void;
  /** False while the hero is off screen, so nothing is drawn. */
  activeRef: MutableRefObject<boolean>;
  onReady?: () => void;
};

const mat = (color: number, rough = 0.6, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.7, ...extra });
const box = (w: number, h: number, d: number, m: THREE.Material, r = 0.01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 32) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const shadowed = <T extends THREE.Object3D>(o: T): T => { o.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const ease = (t: number) => t * t * (3 - 2 * t);

function woodTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#33200f"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * c.height, wob = Math.random() * 6 + 2;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? "12,6,2" : "92,58,32"},${0.05 + Math.random() * 0.16})`;
    g.lineWidth = 0.5 + Math.random() * 2.2;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 32) { const yy = y + Math.sin(x * 0.012 + i) * wob; x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export default function HeroScene({ progressRef, onMonitor, activeRef, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monitorCb = useRef(onMonitor);
  monitorCb.current = onMonitor;

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd6d1c9);
    scene.fog = new THREE.Fog(0xd6d1c9, 14, 30);
    const pm = track(new THREE.PMREMGenerator(renderer));
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;

    // the clay model on its turntable, built from the Ambassador reference views
    const ambassador = createAmbassador({ clay: true });
    const turntable = new THREE.Group();
    ambassador.group.position.y = 0.1;
    const plate = cyl(2.75, 2.82, 0.1, mat(0x1d1d20, 0.35, 0.6)); plate.position.y = 0.05;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffd9a8 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.105;
    turntable.add(ambassador.group, plate, ring);
    turntable.position.set(0, 0, -2.5); turntable.scale.setScalar(1.12);
    scene.add(shadowed(turntable));

    // room
    const floor = new Reflector(new THREE.PlaneGeometry(40, 40), { color: 0x9a968f, textureWidth: 1024, textureHeight: 1024, clipBias: 0.003 });
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.4, transparent: true, opacity: 0.9, envMapIntensity: 0.3 }));
    sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.002; sheen.receiveShadow = true; scene.add(sheen);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), mat(0xc9c3b9, 0.92)); back.position.set(0, 3.5, -4.6); back.receiveShadow = true; scene.add(back);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mat(0xcfcac1, 0.92)); w.position.set(s * 6.4, 3.5, 0.5); w.rotation.y = -s * Math.PI / 2; w.receiveShadow = true; scene.add(w); }
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), mat(0xe6e3dd, 0.95)); ceiling.position.set(0, 4.2, 0.5); ceiling.rotation.x = Math.PI / 2; scene.add(ceiling);
    for (let i = 0; i < 3; i++) { const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.04, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff })); strip.position.set(0, 4.17, -2.5 + i * 3.2); scene.add(strip); }

    // workstation: dark wood, steel, black
    const black = mat(0x131314, 0.55, 0.1), steel = mat(0xc9ccd2, 0.28, 0.9, { envMapIntensity: 1.1 });
    const wood = woodTexture(); wood.repeat.set(2, 1);
    const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.8 });
    const desk = new THREE.Group();
    const top = box(3.6, 0.08, 1.25, woodMat, 0.02); top.position.y = 0.78; desk.add(top);
    for (const x of [-1.66, 1.66]) for (const z of [-0.52, 0.52]) { const leg = box(0.1, 0.78, 0.1, black, 0.015); leg.position.set(x, 0.39, z); desk.add(leg); }
    const rail = box(3.4, 0.1, 0.05, black, 0.01); rail.position.set(0, 0.66, 0.55); desk.add(rail);
    desk.position.set(0, 0, 1.55); scene.add(shadowed(desk));

    const monitor = new THREE.Group();
    const panel = box(1.12, 0.7, 0.05, mat(0x0b0b0c, 0.4, 0.3), 0.02); panel.position.y = 0.37; monitor.add(panel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.62), new THREE.MeshBasicMaterial({ color: 0xefece6, toneMapped: false }));
    screen.position.set(0, 0.37, 0.028); monitor.add(screen);
    const neck = box(0.12, 0.3, 0.05, steel, 0.015); neck.position.set(0, -0.02, -0.02); monitor.add(neck);
    const foot = box(0.4, 0.02, 0.26, steel, 0.01); foot.position.set(0, -0.15, 0.02); monitor.add(foot);
    monitor.position.set(0, 0.9, 1.35); monitor.scale.setScalar(1.0); scene.add(shadowed(monitor));
    const keyboard = box(0.46, 0.018, 0.16, mat(0xe8e8ea, 0.5), 0.008); keyboard.position.set(-0.05, 0.835, 1.9); scene.add(shadowed(keyboard));
    const mouse = box(0.06, 0.02, 0.1, mat(0xf0f0f2, 0.4), 0.02); mouse.position.set(0.45, 0.84, 1.92); scene.add(shadowed(mouse));

    const lamp = new THREE.Group();
    const lbase = cyl(0.13, 0.15, 0.03, black); lbase.position.y = 0.015; lamp.add(lbase);
    const arm1 = cyl(0.012, 0.012, 0.62, black, 12); arm1.position.set(0.1, 0.32, 0); arm1.rotation.z = -0.32; lamp.add(arm1);
    const arm2 = cyl(0.012, 0.012, 0.6, black, 12); arm2.position.set(0.04, 0.78, 0); arm2.rotation.z = 0.5; lamp.add(arm2);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }));
    shade.position.set(-0.22, 1.04, 0); shade.rotation.z = Math.PI / 2 + 0.5; lamp.add(shade);
    lamp.position.set(-1.1, 0.82, 1.62); scene.add(shadowed(lamp));

    const chair = new THREE.Group();
    const seat = box(0.55, 0.09, 0.55, black, 0.04); seat.position.y = 0.52; chair.add(seat);
    const backrest = box(0.5, 0.62, 0.09, black, 0.04); backrest.position.set(0, 0.88, 0.28); backrest.rotation.x = -0.12; chair.add(backrest);
    const post = cyl(0.03, 0.03, 0.4, steel, 16); post.position.y = 0.28; chair.add(post);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, leg = box(0.34, 0.035, 0.05, black, 0.01); leg.position.set(Math.cos(a) * 0.17, 0.09, Math.sin(a) * 0.17); leg.rotation.y = -a; chair.add(leg);
      const caster = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), black); caster.position.set(Math.cos(a) * 0.33, 0.04, Math.sin(a) * 0.33); chair.add(caster);
    }
    chair.position.set(0.05, 0, 3.15); scene.add(shadowed(chair));

    // scanner (left) and robot arm (right)
    const scanner = new THREE.Group();
    const pole = cyl(0.055, 0.055, 2.4, black, 20); pole.position.y = 1.25; scanner.add(pole);
    for (const y of [0.55, 1.3]) { const r = cyl(0.075, 0.075, 0.05, steel, 20); r.position.y = y; scanner.add(r); }
    const clampM = cyl(0.085, 0.085, 0.3, mat(0x2b2b2d, 0.4, 0.5), 20); clampM.position.y = 1.9; scanner.add(clampM);
    const boom = cyl(0.04, 0.04, 0.75, black, 16); boom.rotation.z = Math.PI / 2 - 0.12; boom.position.set(0.36, 2.0, 0); scanner.add(boom);
    const head = new THREE.Group();
    head.add(box(0.46, 0.3, 0.36, mat(0xd6602a, 0.45, 0.1), 0.05));
    const lens = cyl(0.09, 0.11, 0.2, black, 24); lens.rotation.z = Math.PI / 2; lens.position.set(0.3, -0.02, 0); head.add(lens);
    const fin = box(0.1, 0.12, 0.4, mat(0x202020, 0.5), 0.02); fin.position.set(-0.1, 0.2, 0); head.add(fin);
    head.position.set(0.75, 2.08, 0); head.rotation.z = -0.2; head.rotation.y = -0.5; scanner.add(head);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4, leg = box(0.62, 0.05, 0.07, black, 0.015); leg.position.set(Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3); leg.rotation.y = -a; scanner.add(leg);
      const caster = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 12), black); caster.position.set(Math.cos(a) * 0.58, 0.06, Math.sin(a) * 0.58); scanner.add(caster);
    }
    scanner.position.set(-3.9, 0, -0.1); scanner.scale.setScalar(1.1); scene.add(shadowed(scanner));

    const robot = new THREE.Group();
    const white = mat(0xe3e3e4, 0.38, 0.12, { envMapIntensity: 0.9 });
    const tower = box(0.95, 2.35, 0.9, white, 0.06); tower.position.y = 1.5; robot.add(tower);
    const cap = box(1.0, 0.16, 0.95, mat(0x2a2a2c, 0.4, 0.3), 0.04); cap.position.y = 2.7; robot.add(cap);
    const stripe = box(0.06, 2.0, 0.92, mat(0xb9bbbf, 0.3, 0.8), 0.01); stripe.position.set(-0.3, 1.5, 0); robot.add(stripe);
    const baseBlock = box(1.15, 0.28, 1.0, mat(0x35353a, 0.5, 0.3), 0.04); baseBlock.position.y = 0.3; robot.add(baseBlock);
    const hose = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 2.7, 0.1), new THREE.Vector3(0.1, 3.5, 0.15), new THREE.Vector3(-0.7, 3.65, 0.1), new THREE.Vector3(-1.45, 3.1, 0.05), new THREE.Vector3(-1.7, 2.2, 0.05), new THREE.Vector3(-1.62, 1.35, 0.05)]), 120, 0.09, 14, false);
    robot.add(new THREE.Mesh(hose, mat(0x0d0d0e, 0.65, 0.2)));
    const rarm = cyl(0.1, 0.1, 1.9, steel, 28); rarm.rotation.z = Math.PI / 2; rarm.position.set(-1.0, 1.2, 0.05); robot.add(rarm);
    const rarm2 = cyl(0.13, 0.13, 0.18, mat(0x1a1a1c, 0.4, 0.4), 28); rarm2.rotation.z = Math.PI / 2; rarm2.position.set(-1.98, 1.2, 0.05); robot.add(rarm2);
    const rhead = cyl(0.14, 0.17, 0.7, black, 28); rhead.rotation.z = Math.PI / 2; rhead.position.set(-1.62, 1.3, 0.05); robot.add(rhead);
    for (const [x, z] of [[-0.4, -0.38], [0.4, -0.38], [-0.4, 0.38], [0.4, 0.38]]) { const wheel = cyl(0.1, 0.1, 0.07, black, 18); wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 0.1, z); robot.add(wheel); }
    robot.position.set(3.55, 0, -0.1); robot.scale.setScalar(1.05); scene.add(shadowed(robot));

    // lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bd, 0.7));
    const key = new THREE.DirectionalLight(0xfff2e2, 2.4);
    key.position.set(-4.5, 6.5, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -4, far: 24 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 7;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9); rim.position.set(5, 3, -3); scene.add(rim);
    const lampLight = new THREE.PointLight(0xffe2b8, 1.6, 3.2, 2); lampLight.position.set(-1.35, 1.8, 1.7); scene.add(lampLight);

    // camera: the base view, and the push into the monitor
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    const baseTarget = new THREE.Vector3(0, 1.08, 0), endTarget = new THREE.Vector3(0, 1.28, 1.4);
    const endPos = new THREE.Vector3(0, 1.28, 2.45);
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const onPointer = (e: PointerEvent) => { pointer.x = (e.clientX / window.innerWidth - 0.5) * 2; pointer.y = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener("pointermove", onPointer, { passive: true });
    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 1.2 ? 38 : 30;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    let last = { x: -1, y: -1, w: -1, h: -1 }, raf = 0, told = false, disposed = false;
    const tmp = new THREE.Vector3(), basePos = new THREE.Vector3();
    const frame = () => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (!activeRef.current || document.hidden) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!still) turntable.rotation.y += dt * 0.12;
      pointer.sx += (pointer.x - pointer.sx) * 0.04; pointer.sy += (pointer.y - pointer.sy) * 0.04;
      const narrow = camera.aspect < 1.2 ? 1.5 : 1;
      const p = ease(Math.min(1, Math.max(0, progressRef.current)));
      basePos.set(pointer.sx * 0.45 * (1 - p), 1.75 - pointer.sy * 0.1 * (1 - p), 8.9 * narrow);
      camera.position.lerpVectors(basePos, endPos, p);
      tmp.lerpVectors(baseTarget, endTarget, p);
      camera.lookAt(tmp);
      chair.visible = p < 0.6;
      renderer.render(scene, camera);
      // where the monitor's glass is on the canvas, so the page can draw on it
      monitor.updateMatrixWorld(true);
      const rect = canvas.getBoundingClientRect();
      const bl = screen.localToWorld(new THREE.Vector3(-0.52, -0.31, 0)).project(camera);
      const tr = screen.localToWorld(new THREE.Vector3(0.52, 0.31, 0)).project(camera);
      const left = (bl.x * 0.5 + 0.5) * rect.width, right = (tr.x * 0.5 + 0.5) * rect.width;
      const topY = (-tr.y * 0.5 + 0.5) * rect.height, bottomY = (-bl.y * 0.5 + 0.5) * rect.height;
      const r = { x: left, y: topY, w: right - left, h: bottomY - topY };
      if (Math.abs(r.x - last.x) + Math.abs(r.y - last.y) + Math.abs(r.w - last.w) + Math.abs(r.h - last.h) > 0.6) { last = r; monitorCb.current(r); }
      if (!told) { told = true; onReady?.(); }
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      disposables.forEach((d) => d.dispose());
      ambassador.dispose();
      wood.dispose();
      renderer.dispose();
    };
  }, [activeRef, progressRef, onReady]);

  return <canvas ref={canvasRef} className="lp-scene" aria-hidden="true" />;
}
