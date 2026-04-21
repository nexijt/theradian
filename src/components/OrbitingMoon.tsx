import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface OrbitingMoonProps {
  onClick: () => void;
  label?: string;
}

const MOON_COLOR = 0x4a5060;

/** Small-circle on the sphere surface for a crater ring (same math as Moon.tsx) */
function craterCircle(
  lat: number,
  lon: number,
  angularRadiusDeg: number,
  r: number,
  segments = 28
): THREE.Vector3[] {
  const angR = angularRadiusDeg * (Math.PI / 180);
  const latR = lat * (Math.PI / 180);
  const lonR = (lon + 180) * (Math.PI / 180);
  const center = new THREE.Vector3(
    -Math.cos(latR) * Math.cos(lonR),
    Math.sin(latR),
    Math.cos(latR) * Math.sin(lonR)
  ).normalize();
  const arbitrary =
    Math.abs(center.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
  const u = arbitrary
    .clone()
    .sub(center.clone().multiplyScalar(arbitrary.dot(center)))
    .normalize();
  const v = new THREE.Vector3().crossVectors(center, u).normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const p = center
      .clone()
      .multiplyScalar(Math.cos(angR))
      .add(u.clone().multiplyScalar(Math.sin(angR) * Math.cos(t)))
      .add(v.clone().multiplyScalar(Math.sin(angR) * Math.sin(t)));
    pts.push(p.normalize().multiplyScalar(r));
  }
  return pts;
}

const MINI_CRATERS = [
  { lat: 33, lon: -17, r: 8, segs: 28 },
  { lat: 28, lon: 17, r: 5, segs: 22 },
  { lat: 8, lon: 31, r: 6, segs: 22 },
  { lat: 45, lon: 0, r: 4.5 },
  { lat: -20, lon: 30, r: 5.5, segs: 22 },
  { lat: 15, lon: -50, r: 5 },
  { lat: -43, lon: -11, r: 3.5 },
  { lat: 10, lon: -20, r: 3 },
  { lat: 50, lon: -40, r: 2.5 },
  { lat: -60, lon: 100, r: 4 },
];

/**
 * A small Three.js moon mesh that auto-rotates in the bottom-right corner.
 * Clicking it triggers the Earth → Moon scene transition.
 */
export default function OrbitingMoon({ onClick, label }: OrbitingMoonProps) {
  const orbitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Subtle orbital float animation */
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const radius = 14;
    const period = 9000;
    const tick = () => {
      const t = (performance.now() - start) / period;
      const a = t * Math.PI * 2;
      if (orbitRef.current) {
        orbitRef.current.style.transform = `translate(${Math.cos(a) * radius}px, ${Math.sin(a) * radius * 0.45}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Three.js mini moon renderer */
  useEffect(() => {
    const canvas = canvasRef.current!;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Render at 80×80 internally; CSS scales to fill the button
    renderer.setSize(80, 80, false);
    renderer.setClearColor(0x000000, 0); // transparent background

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0, 0, 0);

    // Depth mask — occludes geometry behind the surface
    const solidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.997, 40, 32),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true })
    );

    // Visible surface at 30% opacity — dark lunar grey
    const surfaceMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.995, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x12151a,
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
      })
    );

    // Wireframe lattice
    const wireMesh = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(1.001, 28, 18)),
      new THREE.LineBasicMaterial({ color: MOON_COLOR, transparent: true, opacity: 0.26 })
    );

    // Crater rings
    const rimMat = new THREE.LineBasicMaterial({ color: 0x737d8c, transparent: true, opacity: 0.80 });
    const bowlMat = new THREE.LineBasicMaterial({ color: 0x2e3340, transparent: true, opacity: 0.65 });
    const craterGroup = new THREE.Group();

    MINI_CRATERS.forEach(({ lat, lon, r: angR, segs = 20 }) => {
      const rimPts = craterCircle(lat, lon, angR, 1.004, segs);
      craterGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rimPts), rimMat));
      if (angR >= 1.0) {
        const bowlPts = craterCircle(lat, lon, angR * 0.58, 0.999, Math.max(12, Math.floor(segs * 0.6)));
        craterGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bowlPts), bowlMat));
      }
    });

    const moonGroup = new THREE.Group();
    moonGroup.add(solidMesh, surfaceMesh, wireMesh, craterGroup);
    moonGroup.rotation.x = 0.28;
    scene.add(moonGroup);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      moonGroup.rotation.y += 0.006;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      [solidMesh, wireMesh].forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      craterGroup.children.forEach((c) => {
        (c as THREE.Line).geometry.dispose();
      });
      rimMat.dispose();
      bowlMat.dispose();
    };
  }, []);

  return (
    <div className="fixed bottom-16 right-6 sm:bottom-20 sm:right-10 z-50">
      {/* Orbit path ring */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center pointer-events-none">
        <div
          className="absolute inset-0 rounded-full border border-foreground/15"
          style={{ transform: "scaleY(0.45)" }}
          aria-hidden
        />

        {/* Moon — floats around the ring center */}
        <div ref={orbitRef} className="absolute pointer-events-auto">
          <button
            onClick={onClick}
            aria-label={label ? `${label} — open your moon` : "Open your moon"}
            title={label || "Your moon"}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full cursor-pointer overflow-hidden transition-transform hover:scale-110 active:scale-95"
            style={{
              boxShadow:
                "inset -3px -3px 7px rgba(0,0,0,0.55), 0 0 18px rgba(255,255,255,0.08), 0 2px 10px rgba(0,0,0,0.45)",
              display: "block",
            }}
          >
            <canvas ref={canvasRef} className="w-full h-full block" />
          </button>
        </div>
      </div>

      {/* Username label */}
      {label && (
        <div className="font-mono text-[0.48rem] tracking-[0.2em] uppercase text-muted-foreground whitespace-nowrap text-right pointer-events-none -mt-1 pr-1">
          {label}
        </div>
      )}
    </div>
  );
}
