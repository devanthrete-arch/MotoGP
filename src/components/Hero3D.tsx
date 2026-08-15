import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Hero3D — Obsidian Velocity interactive Three.js hero.
 *
 * Port of template_reference/obsidian_velocity_interactive_3d_hero:
 * a wireframe/graphite hypercar silhouette built from primitives,
 * floating over a telemetry grid, with pointer-driven parallax
 * rotation. Recolored from the template's teal accents to the
 * Obsidian Velocity palette (#141313 base, #c7c6cb primary tint).
 *
 * - Everything lives in one useEffect with full cleanup.
 * - prefers-reduced-motion: renders a single static frame.
 * - Loop pauses when the tab is hidden or the canvas scrolls
 *   off-screen.
 * - If WebGL is unavailable, falls back to a styled static panel
 *   with the same dimensions.
 */

const COLOR = {
  bodyGraphite: 0x1c1b1c,
  chassisDeep: 0x0b0c10,
  primaryTint: 0xc7c6cb,
  specular: 0xe3e2e8,
  gridLine: 0x2a2a2a,
  gridCenter: 0x46464b,
} as const;

export default function Hero3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- Renderer (guarded: WebGL may be unavailable) -----------------
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 360;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    // --- Scene & camera ----------------------------------------------
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0e0e0e, 8, 22);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 7);
    camera.lookAt(0, 0, 0);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const track = <G extends THREE.BufferGeometry>(g: G): G => {
      geometries.push(g);
      return g;
    };
    const trackMat = <M extends THREE.Material>(m: M): M => {
      materials.push(m);
      return m;
    };

    // --- Materials (obsidian palette) --------------------------------
    const wireframeMaterial = trackMat(
      new THREE.MeshPhongMaterial({
        color: COLOR.primaryTint,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      }),
    );
    const bodyMaterial = trackMat(
      new THREE.MeshPhongMaterial({
        color: COLOR.bodyGraphite,
        specular: COLOR.specular,
        shininess: 90,
        transparent: true,
        opacity: 0.85,
      }),
    );
    const wheelMaterial = trackMat(
      new THREE.MeshPhongMaterial({
        color: COLOR.chassisDeep,
        specular: COLOR.primaryTint,
        shininess: 40,
      }),
    );

    // --- Simplified hypercar silhouette (as in the template) ---------
    const carGroup = new THREE.Group();

    const bodyGeom = track(new THREE.BoxGeometry(4, 0.8, 2));
    carGroup.add(new THREE.Mesh(bodyGeom, bodyMaterial));

    const cabinGeom = track(new THREE.BoxGeometry(1.5, 0.6, 1.4));
    const cabin = new THREE.Mesh(cabinGeom, bodyMaterial);
    cabin.position.set(-0.2, 0.6, 0);
    carGroup.add(cabin);

    const frontGeom = track(new THREE.BoxGeometry(2, 0.4, 1.8));
    const front = new THREE.Mesh(frontGeom, bodyMaterial);
    front.position.set(2, -0.1, 0);
    front.rotation.z = -0.1;
    carGroup.add(front);

    // Wireframe overlay for the technical HUD look
    carGroup.add(new THREE.Mesh(bodyGeom, wireframeMaterial));
    const cabinWire = new THREE.Mesh(cabinGeom, wireframeMaterial);
    cabinWire.position.copy(cabin.position);
    carGroup.add(cabinWire);

    // Wheels
    const wheelGeom = track(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16));
    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      { x: 1.5, y: -0.4, z: 1 },
      { x: 1.5, y: -0.4, z: -1 },
      { x: -1.5, y: -0.4, z: 1 },
      { x: -1.5, y: -0.4, z: -1 },
    ];
    for (const pos of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeom, wheelMaterial);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(pos.x, pos.y, pos.z);
      carGroup.add(wheel);
      wheels.push(wheel);
    }

    carGroup.rotation.set(0.2, -0.5, 0);
    scene.add(carGroup);

    // --- Telemetry floor grid ----------------------------------------
    const grid = new THREE.GridHelper(40, 40, COLOR.gridCenter, COLOR.gridLine);
    grid.position.y = -1.1;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    track(grid.geometry);
    trackMat(grid.material as THREE.Material);
    scene.add(grid);

    // --- Lights (recolored from teal to primary tint) ----------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    const directionalLight = new THREE.DirectionalLight(COLOR.primaryTint, 1.1);
    directionalLight.position.set(5, 5, 5);
    const pointLight = new THREE.PointLight(COLOR.primaryTint, 0.8, 12);
    pointLight.position.set(-5, 2, -2);
    scene.add(ambientLight, directionalLight, pointLight);

    // --- Interactivity: pointer parallax -----------------------------
    let mouseX = 0;
    let mouseY = 0;
    const onPointerMove = (event: PointerEvent) => {
      mouseX = event.clientX / window.innerWidth - 0.5;
      mouseY = event.clientY / window.innerHeight - 0.5;
    };

    // --- Animation loop with visibility gating -----------------------
    let frameId = 0;
    let running = false;
    let pageVisible = document.visibilityState !== "hidden";
    let inView = true;
    let disposed = false;

    const renderFrame = () => renderer.render(scene, camera);

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const targetRotY = mouseX * 2 - 0.5;
      const targetRotX = mouseY * 1 + 0.2;
      carGroup.rotation.y += (targetRotY - carGroup.rotation.y) * 0.05;
      carGroup.rotation.x += (targetRotX - carGroup.rotation.x) * 0.05;
      carGroup.position.y = Math.sin(Date.now() * 0.002) * 0.1;
      for (const wheel of wheels) wheel.rotation.y += 0.05;
      renderFrame();
    };

    const syncLoop = () => {
      if (disposed || reducedMotion) return;
      const shouldRun = pageVisible && inView;
      if (shouldRun && !running) {
        running = true;
        frameId = requestAnimationFrame(animate);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(frameId);
      }
    };

    const onVisibilityChange = () => {
      pageVisible = document.visibilityState !== "hidden";
      syncLoop();
    };

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver((entries) => {
        inView = entries[0]?.isIntersecting ?? true;
        syncLoop();
      });
      intersectionObserver.observe(container);
    }

    // --- Container-driven resize -------------------------------------
    const onResize = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (reducedMotion || !running) renderFrame();
    };
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", onResize);
    }

    // --- Start --------------------------------------------------------
    if (reducedMotion) {
      renderFrame(); // single static frame, no loop, no pointer tracking
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
      syncLoop();
    }

    // --- Cleanup ------------------------------------------------------
    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section
      className="relative w-full h-[300px] md:h-[420px] bg-surface-container-lowest overflow-hidden"
      aria-label="AutoFlex interactive telemetry hero"
    >
      {/* Three.js canvas mount (or static fallback) */}
      {webglFailed ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 60%, rgba(199,198,203,0.08), transparent 65%)," +
              "linear-gradient(rgba(199,198,203,0.05) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(199,198,203,0.05) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 40px 40px, 40px 40px",
          }}
        />
      ) : (
        <div ref={containerRef} className="absolute inset-0" />
      )}

      {/* Abstract grid overlay (from template) */}
      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(199,198,203,0.05) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(199,198,203,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Scanline treatment */}
      <div className="absolute inset-0 z-10 pointer-events-none scanline" />
      {/* Bottom fade into the page surface */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent" />

      {/* HUD chips and hero copy are owned by the host screen (Home.tsx
          overlays live vehicle telemetry), so the canvas stays clean. */}
    </section>
  );
}
