// The virtual showroom's 3D stage: a car on a turntable under studio softboxes, over a polished
// floor. Kept in its own file so three.js and drei are only downloaded when the showroom opens.
import { Component, Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdaptiveDpr, ContactShadows, Environment, Lightformer, MeshReflectorMaterial, OrbitControls, PerformanceMonitor,
  useGLTF, useProgress,
} from "@react-three/drei";
import type { KTX2Loader as StdlibKTX2Loader, OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import * as THREE from "three";
import type { ShowroomCar } from "./showroomManifest";

// The Draco decoder is served from this site (public/draco/), not from a CDN.
const dracoPath = "/draco/";
// The KTX2 loader (about 24 kB) and the Basis transcoder it bundles beside itself are fetched only
// for a car whose textures need them.
let ktx2Module: Promise<typeof import("three/addons/loaders/KTX2Loader.js")> | undefined;
const loadKtx2 = () => (ktx2Module ??= import("three/addons/loaders/KTX2Loader.js"));
const ktx2Loaders = new WeakMap<THREE.WebGLRenderer, KTX2Loader>();
// One KTX2 loader per renderer: it picks the texture format this GPU supports.
const ktx2LoaderFor = (gl: THREE.WebGLRenderer, Loader: typeof KTX2Loader) => {
  let loader = ktx2Loaders.get(gl);
  if (!loader) {
    loader = new Loader().detectSupport(gl);
    ktx2Loaders.set(gl, loader);
  }
  return loader;
};
const backdrop = "#101214";

export type ShowroomSceneProps = {
  car: ShowroomCar;
  paint: string;
  playing: boolean;
  /** A coarse pointer or a narrow screen: draw at a lower resolution from the start. */
  compact: boolean;
  /** Bumped by the "reset view" button. */
  resetSignal: number;
  onModelError: (carId: string) => void;
  /** WebGL stopped working after it started (the GPU was reset or the context was lost). */
  onContextLost: () => void;
};

class ModelBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Car({ car, paint, lowDetail, onShown }: { car: ShowroomCar; paint: string; lowDetail: boolean; onShown: () => void }) {
  const gl = useThree((state) => state.gl);
  const ktx2 = car.ktx2 ? use(loadKtx2()) : null;
  const { scene } = useGLTF(lowDetail && car.srcLow ? car.srcLow : car.src, dracoPath, true, (loader) => {
    // three's own KTX2 loader does the same job as the stdlib one drei's GLTF loader is typed for.
    if (ktx2) loader.setKTX2Loader(ktx2LoaderFor(gl, ktx2.KTX2Loader) as unknown as StdlibKTX2Loader);
  });
  const invalidate = useThree((state) => state.invalidate);
  const firstPaint = useRef(paint);
  // A copy per showroom visit: useGLTF caches the file, and recolouring must not leak into the cache.
  const { model, paints } = useMemo(() => {
    const model = scene.clone(true);
    const names = new Set(car.paintMaterials);
    const paints: THREE.MeshStandardMaterial[] = [];
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const swap = (material: THREE.Material) => {
        if (!names.has(material.name) || !(material as THREE.MeshStandardMaterial).isMeshStandardMaterial) return material;
        const copy = (material as THREE.MeshStandardMaterial).clone();
        copy.color.set(firstPaint.current);
        paints.push(copy);
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    // Turned to face +X first, then every model stands at true length, centred on the turntable,
    // wheels on the floor.
    model.rotation.y = THREE.MathUtils.degToRad(car.yawDegrees);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(car.lengthMetres / Math.max(size.x, size.z, 0.001));
    box.setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    return { model, paints };
  }, [scene, car]);

  useEffect(() => () => paints.forEach((material) => material.dispose()), [paints]);
  // Light and car stand still while the camera circles, so the shadow map is drawn once per car.
  useEffect(() => { gl.shadowMap.needsUpdate = true; invalidate(); }, [gl, model, invalidate]);

  const target = useMemo(() => new THREE.Color(paint), [paint]);
  useEffect(() => invalidate(), [target, invalidate]);
  // The paint eases to the new colour instead of snapping.
  const shown = useRef(false);
  useFrame((_, delta) => {
    if (!shown.current) { shown.current = true; onShown(); }
    let moving = false;
    for (const material of paints) {
      material.color.lerp(target, 1 - Math.exp(-delta * 7));
      if (Math.abs(material.color.r - target.r) + Math.abs(material.color.g - target.g) + Math.abs(material.color.b - target.b) > 0.002) moving = true;
    }
    if (moving) invalidate();
  });

  return <primitive object={model} />;
}

function Floor({ reflective, compact }: { reflective: boolean; compact: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        {reflective ? (
          <MeshReflectorMaterial
            color="#1a1d20" metalness={0.4} roughness={0.85}
            resolution={compact ? 256 : 512} blur={[300, 80]} mixBlur={1} mixStrength={18} mixContrast={1}
            depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.2} mirror={0}
          />
        ) : <meshStandardMaterial color="#1a1d20" metalness={0.3} roughness={0.45} />}
      </mesh>
      {/* The turntable's edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.15, 3.2, 96]} />
        <meshBasicMaterial color="#5c6670" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function Studio() {
  return (
    // Softboxes drawn into the reflection map once; no HDRI file is downloaded.
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={1.8} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 4, 1]} />
      <Lightformer form="rect" intensity={1.6} position={[-7, 2.2, 0]} rotation-y={Math.PI / 2} scale={[12, 1.6, 1]} />
      <Lightformer form="rect" intensity={1.6} position={[7, 2.2, 0]} rotation-y={-Math.PI / 2} scale={[12, 1.6, 1]} />
      <Lightformer form="rect" intensity={0.9} position={[0, 2, 8]} scale={[10, 2, 1]} />
      <Lightformer form="ring" color="#ffd8a8" intensity={1.4} scale={3} position={[0, 3.5, -9]} />
    </Environment>
  );
}

const target = new THREE.Vector3(0, 0.7, 0);

function Controls({ playing, resetSignal, length }: { playing: boolean; resetSignal: number; length: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const { width, height } = useThree((state) => state.size);
  useEffect(() => { if (resetSignal) controls.current?.reset(); }, [resetSignal]);
  // Frames the whole car whatever the screen's shape: a tall phone screen needs the camera further back.
  useEffect(() => {
    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * (width / Math.max(height, 1)));
    const distance = Math.max((length * 0.62 + 0.5) / Math.tan(horizontal), 2 / Math.tan(vertical), 5.5);
    const direction = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).addScaledVector(direction, distance);
    const orbit = controls.current;
    if (!orbit) return;
    orbit.minDistance = Math.min(3.6, distance * 0.6);
    orbit.maxDistance = distance * 1.5;
    orbit.update();
    orbit.saveState();
  }, [camera, width, height, length]);
  return (
    <OrbitControls
      ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08}
      minPolarAngle={0.35} maxPolarAngle={Math.PI / 2.08}
      target={target} autoRotate={playing} autoRotateSpeed={0.9}
      // While the visitor drags, AdaptiveDpr drops the resolution for smoothness.
      regress
    />
  );
}

export default function ShowroomScene(props: ShowroomSceneProps) {
  const { car, paint, playing, compact, resetSignal, onModelError, onContextLost } = props;
  const maxDpr = compact ? 1.5 : 2;
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio || 1, maxDpr));
  // Dropped for good once the device shows it cannot keep up.
  const [reflective, setReflective] = useState(true);
  // Phones start on a car's light model (when it has one); any device that falls back joins them.
  const [lowDetail, setLowDetail] = useState(compact);
  // The first frame with the car can wait on shader compiling; say so rather than show an empty stage.
  const [shownCar, setShownCar] = useState("");

  return (<>
    <Canvas
      className="showroom-canvas"
      dpr={dpr}
      shadows="percentage"
      frameloop={playing ? "always" : "demand"}
      camera={{ position: [5.6, 1.9, 6.4], fov: compact ? 42 : 34, near: 0.1, far: 80 }}
      gl={{ antialias: !compact, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.shadowMap.autoUpdate = false;
        gl.domElement.addEventListener("webglcontextlost", (event) => { event.preventDefault(); onContextLost(); }, { once: true });
      }}
    >
      <PerformanceMonitor
        bounds={(refresh) => (refresh > 90 ? [50, 90] : [40, 58])}
        onChange={({ factor }) => setDpr(Math.round((0.75 + (maxDpr - 0.75) * factor) * 4) / 4)}
        onDecline={() => setReflective(false)}
        onFallback={() => { setReflective(false); setDpr(1); setLowDetail(true); }}
        flipflops={3}
      />
      <AdaptiveDpr pixelated />
      <color attach="background" args={[backdrop]} />
      <fog attach="fog" args={[backdrop, 12, 26]} />
      <ambientLight intensity={0.15} />
      {/* A key light from above for real shadows: under the sills, in the arches, from the mirrors. */}
      <directionalLight
        castShadow position={[2.5, 7, 3]} intensity={1.1}
        shadow-mapSize={compact ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-3.6} shadow-camera-right={3.6} shadow-camera-top={3.6} shadow-camera-bottom={-3.6}
        shadow-camera-near={1} shadow-camera-far={14}
      />
      <Studio />
      <Floor reflective={reflective} compact={compact} />
      <ModelBoundary key={car.id} onError={() => onModelError(car.id)}>
        <Suspense fallback={null}>
          <Car car={car} paint={paint} lowDetail={lowDetail} onShown={() => setShownCar(car.id)} />
          {/* The car stands still and the camera circles it, so the shadow is drawn once. */}
          <ContactShadows position={[0, 0.003, 0]} scale={11} blur={2.2} far={3} opacity={0.75} resolution={compact ? 512 : 1024} frames={1} />
        </Suspense>
      </ModelBoundary>
      <Controls playing={playing} resetSignal={resetSignal} length={car.lengthMetres} />
    </Canvas>
    <ShowroomProgress preparing={shownCar !== car.id} />
  </>);
}

/** The model download's progress, shown over the stage. Reads drei's loader store, so it works outside the canvas. */
function ShowroomProgress({ preparing }: { preparing: boolean }) {
  const { active, progress } = useProgress();
  if (!active && preparing) {
    return <div className="showroom-progress" role="status"><span>Preparing the studio…</span></div>;
  }
  if (!active) return null;
  const percent = Math.round(progress);
  return (
    <div className="showroom-progress" role="progressbar" aria-label="Loading the 3D model" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span>Loading the 3D model… {percent}%</span>
      <span className="showroom-progress__track"><span style={{ inlineSize: `${percent}%` }} /></span>
    </div>
  );
}
