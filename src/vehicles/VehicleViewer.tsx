import { Component, useEffect, useRef, useState } from "react";
import type { ErrorInfo, MutableRefObject, ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import { RotateCcw, RotateCw } from "lucide-react";
import { IconButton } from "../ui/Button";

type Props = { paint: string; shape: "crossover" | "motorcycle" };
type BoundaryProps = { children: ReactNode; fallback: ReactNode };
type BoundaryState = { failed: boolean };

class ViewerBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Keep the photo fallback in place if WebGL is unavailable. */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const body = new THREE.Shape();
body.moveTo(-1.72, 0.46);
body.lineTo(-1.72, 0.87);
body.quadraticCurveTo(-1.66, 1.02, -1.42, 1.08);
body.lineTo(-0.92, 1.16);
body.lineTo(-0.37, 1.72);
body.quadraticCurveTo(-0.22, 1.86, 0.02, 1.86);
body.lineTo(0.42, 1.86);
body.quadraticCurveTo(0.64, 1.84, 0.77, 1.64);
body.lineTo(1.13, 1.13);
body.lineTo(1.6, 1.05);
body.quadraticCurveTo(1.77, 1.0, 1.8, 0.83);
body.lineTo(1.72, 0.46);
body.closePath();

const sideGlass = new THREE.Shape();
sideGlass.moveTo(-0.8, 1.22);
sideGlass.lineTo(-0.32, 1.7);
sideGlass.lineTo(0.38, 1.7);
sideGlass.quadraticCurveTo(0.51, 1.68, 0.61, 1.52);
sideGlass.lineTo(0.85, 1.18);
sideGlass.lineTo(-0.8, 1.22);

const extrusion = { depth: 1.34, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.035, steps: 1 };
const glassExtrusion = { depth: 0.016, bevelEnabled: false, steps: 1 };

function Wheel({ x, z }: { x: number; z: number }) {
  const faceZ = z > 0 ? z + 0.105 : z - 0.105;
  return <group position={[x, 0.45, z]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.38, 0.38, 0.21, 24]} />
      <meshStandardMaterial color="#202427" roughness={0.86} />
    </mesh>
    <mesh position={[0, 0, faceZ - z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.245, 0.245, 0.025, 24]} />
      <meshStandardMaterial color="#b7bab5" metalness={0.82} roughness={0.3} />
    </mesh>
    <mesh position={[0, 0, (z > 0 ? 1 : -1) * 0.125]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.105, 0.105, 0.03, 20]} />
      <meshStandardMaterial color="#3d4549" metalness={0.6} roughness={0.34} />
    </mesh>
  </group>;
}

function Crossover({ paint, rotation }: { paint: string; rotation: number }) {
  return <group rotation={[0, rotation, 0]}>
    <mesh position={[0, 0, -0.67]} castShadow>
      <extrudeGeometry args={[body, extrusion]} />
      <meshPhysicalMaterial color={paint} metalness={0.66} roughness={0.3} clearcoat={0.85} clearcoatRoughness={0.22} />
    </mesh>
    <mesh position={[0, 0, 0.69]}>
      <extrudeGeometry args={[sideGlass, glassExtrusion]} />
      <meshPhysicalMaterial color="#19272c" roughness={0.24} metalness={0.28} clearcoat={0.8} />
    </mesh>
    <mesh position={[0, 0, -0.69]}>
      <extrudeGeometry args={[sideGlass, glassExtrusion]} />
      <meshPhysicalMaterial color="#19272c" roughness={0.24} metalness={0.28} clearcoat={0.8} />
    </mesh>
    <mesh position={[-0.05, 1.45, 0]}>
      <boxGeometry args={[0.055, 0.62, 1.37]} />
      <meshStandardMaterial color="#172329" roughness={0.42} />
    </mesh>
    <mesh position={[1.72, 0.7, 0]}>
      <boxGeometry args={[0.15, 0.2, 0.86]} />
      <meshStandardMaterial color="#23292c" roughness={0.6} />
    </mesh>
    {[0.48, -0.48].map(z => <group key={z} position={[1.79, 0.91, z]}>
      <mesh><boxGeometry args={[0.045, 0.105, 0.24]} /><meshStandardMaterial color="#eef0df" emissive="#d7d9bc" emissiveIntensity={0.18} /></mesh>
    </group>)}
    {[0.47, -0.47].map(z => <mesh key={z} position={[-1.68, 0.87, z]}>
      <boxGeometry args={[0.06, 0.13, 0.23]} /><meshStandardMaterial color="#8f3231" emissive="#511817" emissiveIntensity={0.12} />
    </mesh>)}
    {[-0.72, 0.72].flatMap(z => [-1.05, 1.05].map(x => <Wheel key={`${x}:${z}`} x={x} z={z} />))}
    {[-0.54, 0.54].map(z => <mesh key={z} position={[0.58, 1.16, z]}>
      <boxGeometry args={[0.16, 0.16, 0.13]} /><meshStandardMaterial color="#243138" metalness={0.44} roughness={0.3} />
    </mesh>)}
    {[-0.48, 0.48].map(z => <mesh key={z} position={[0, 1.91, z]}>
      <boxGeometry args={[1.02, 0.045, 0.045]} /><meshStandardMaterial color="#b8bdb7" metalness={0.7} roughness={0.26} />
    </mesh>)}
  </group>;
}

function BikeWheel({ x, paint }: { x: number; paint: string }) {
  return <group position={[x, 0.48, 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.39, 0.39, 0.11, 28]} />
      <meshStandardMaterial color="#222629" roughness={0.84} />
    </mesh>
    <mesh>
      <torusGeometry args={[0.29, 0.025, 7, 24]} />
      <meshStandardMaterial color="#b7bab5" metalness={0.82} roughness={0.3} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.09, 0.09, 0.15, 16]} />
      <meshStandardMaterial color={paint} metalness={0.62} roughness={0.32} />
    </mesh>
  </group>;
}

function FrameTube({ from, to, radius = 0.045, color = "#858c8b" }: {
  from: [number, number]; to: [number, number]; radius?: number; color?: string;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0]}
    rotation={[0, 0, Math.atan2(-dx, dy)]}>
    <cylinderGeometry args={[radius, radius, Math.hypot(dx, dy), 8]} />
    <meshStandardMaterial color={color} metalness={0.72} roughness={0.3} />
  </mesh>;
}

function Motorcycle({ paint, rotation }: { paint: string; rotation: number }) {
  return <group rotation={[0, rotation, 0]}>
    <BikeWheel x={-0.94} paint={paint} />
    <BikeWheel x={0.94} paint={paint} />
    <FrameTube from={[-0.94, 0.48]} to={[-0.28, 0.9]} />
    <FrameTube from={[-0.28, 0.9]} to={[0.34, 0.82]} />
    <FrameTube from={[0.34, 0.82]} to={[0.94, 0.48]} />
    <FrameTube from={[-0.28, 0.9]} to={[0.5, 1.02]} />
    <FrameTube from={[0.5, 1.02]} to={[0.94, 0.48]} radius={0.032} />
    <mesh position={[0.02, 0.75, 0]}>
      <boxGeometry args={[0.5, 0.42, 0.35]} />
      <meshStandardMaterial color="#353c3e" metalness={0.42} roughness={0.44} />
    </mesh>
    <mesh position={[-0.38, 1.02, 0]} rotation={[0, 0, Math.PI / 2]}>
      <capsuleGeometry args={[0.19, 0.38, 4, 10]} />
      <meshPhysicalMaterial color={paint} metalness={0.55} roughness={0.32} clearcoat={0.8} />
    </mesh>
    <mesh position={[-0.6, 1.11, 0]} rotation={[0, 0, -0.08]}>
      <boxGeometry args={[0.48, 0.12, 0.34]} />
      <meshStandardMaterial color="#242a2c" roughness={0.72} />
    </mesh>
    <FrameTube from={[0.55, 1.14]} to={[0.92, 0.53]} radius={0.025} color="#b7bab5" />
    <FrameTube from={[0.46, 1.14]} to={[0.85, 0.51]} radius={0.025} color="#b7bab5" />
    <FrameTube from={[0.43, 1.18]} to={[0.72, 1.24]} radius={0.026} color="#b7bab5" />
    <mesh position={[0.42, 1.08, 0]}>
      <sphereGeometry args={[0.14, 16, 12]} />
      <meshStandardMaterial color="#f1edcf" emissive="#b9b38e" emissiveIntensity={0.18} />
    </mesh>
    <mesh position={[-0.88, 1.14, 0]}>
      <boxGeometry args={[0.08, 0.12, 0.22]} />
      <meshStandardMaterial color="#8f3231" emissive="#511817" emissiveIntensity={0.12} />
    </mesh>
    <FrameTube from={[-0.22, 0.67]} to={[-0.74, 0.58]} radius={0.06} color="#858c8b" />
  </group>;
}

function Scene({ paint, rotation, shape, controls }: { paint: string; rotation: number; shape: Props["shape"]; controls: MutableRefObject<OrbitControlsType | null> }) {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = false;
    orbit.enablePan = false;
    orbit.minDistance = 4.3;
    orbit.maxDistance = 8.5;
    orbit.minPolarAngle = 0.68;
    orbit.maxPolarAngle = 1.48;
    orbit.target.set(0, 0.92, 0);
    orbit.update();
    const requestFrame = () => invalidate();
    orbit.addEventListener("change", requestFrame);
    controls.current = orbit;
    return () => {
      orbit.removeEventListener("change", requestFrame);
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, controls, gl, invalidate]);
  return <>
    <hemisphereLight args={["#ffffff", "#697274", 2.1]} />
    <directionalLight position={[3, 6, 5]} intensity={2.2} />
    <directionalLight position={[-4, 3, -3]} intensity={1.1} color="#d7e5df" />
    <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[2.25, 48]} />
      <meshBasicMaterial color="#40494c" transparent opacity={0.15} depthWrite={false} />
    </mesh>
    {shape === "motorcycle" ? <Motorcycle paint={paint} rotation={rotation} /> : <Crossover paint={paint} rotation={rotation} />}
  </>;
}

export default function VehicleViewer({ paint, shape }: Props) {
  const [rotation, setRotation] = useState(0);
  const controls = useRef<OrbitControlsType | null>(null);
  const poster = shape === "motorcycle"
    ? <div className="vehicle-viewer__fallback-bike" role="img" aria-label="Generic motorcycle illustration, shown for illustration">
      <span /><span /><i />
    </div>
    : <img className="landing-stage__poster" src="/vehicles/compact-crossover-poster.webp"
      alt="Generic compact crossover concept, shown for illustration" width="1439" height="810" />;
  const label = shape === "motorcycle" ? "motorcycle" : "compact crossover";

  return <div className="vehicle-viewer" data-shape={shape} data-rotation={rotation.toFixed(3)}>
    <ViewerBoundary fallback={poster}>
      <Canvas key={shape} className="vehicle-viewer__canvas" role="img" aria-label={`Interactive 3D generic ${label} concept`}
        dpr={[1, 1.5]} frameloop="demand" camera={{ position: [4.6, 2.35, 5.9], fov: 35 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}>
        <Scene paint={paint} rotation={rotation} shape={shape} controls={controls} />
      </Canvas>
    </ViewerBoundary>
    <div className="vehicle-viewer__actions" aria-label="Vehicle view controls">
      <IconButton label="Rotate vehicle left" onClick={() => setRotation(value => value - Math.PI / 8)}><RotateCcw size={16} aria-hidden="true" /></IconButton>
      <IconButton label="Rotate vehicle right" onClick={() => setRotation(value => value + Math.PI / 8)}><RotateCw size={16} aria-hidden="true" /></IconButton>
      <IconButton label="Reset vehicle view" onClick={() => { setRotation(0); controls.current?.reset(); }}><RotateCcw size={16} aria-hidden="true" /></IconButton>
    </div>
    <p className="vehicle-viewer__caption">Illustrative {shape} shape · not a specific make or model</p>
  </div>;
}
