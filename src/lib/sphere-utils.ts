import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Wireframe } from "three/examples/jsm/lines/Wireframe.js";
import { WireframeGeometry2 } from "three/examples/jsm/lines/WireframeGeometry2.js";
import type { FeedPost } from "@/hooks/useFeed";
import { RADIUS } from "@/lib/scene-constants";

export function projectPoint(lat: number, lon: number, r: number): THREE.Vector3 {
  const latR = lat * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.cos(latR) * Math.cos(theta),
    r * Math.sin(latR),
    r * Math.cos(latR) * Math.sin(theta),
  );
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/** Shared fields for post annotation objects rendered on both Globe and Moon. */
export interface PostObjectBase {
  localPos: THREE.Vector3;
  dot: THREE.Mesh;
  el: HTMLDivElement;
  originEl: HTMLDivElement;
  data: FeedPost;
  progress: number;
  lagX: number | null;
  lagY: number | null;
  lineLengthMult: number;
  facing: number;
  tagColorRgb: [number, number, number];
}

/** Invisible depth-mask sphere — occludes geometry behind the surface. Identical in Globe and Moon. */
export function createDepthMask(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 0.997, 64, 48),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
  );
}

/** Translucent coloured surface sphere. Pass the scene-specific base color. */
export function createSurfaceMesh(color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 0.995, 48, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }),
  );
}

/**
 * Line2-based wireframe sphere with configurable appearance.
 * Returns both the mesh and material so callers can update resolution on resize.
 */
export function createWireframeMesh(options: {
  color: number;
  linewidth: number;
  opacity: number;
  resolution: THREE.Vector2;
}): { mesh: Wireframe; material: LineMaterial } {
  const material = new LineMaterial({
    color: options.color,
    linewidth: options.linewidth,
    transparent: true,
    opacity: options.opacity,
    resolution: options.resolution,
  });
  const mesh = new Wireframe(
    new WireframeGeometry2(new THREE.SphereGeometry(RADIUS * 1.001, 36, 24)),
    material,
  );
  mesh.computeLineDistances();
  return { mesh, material };
}

// Re-export Line2 and LineMaterial so Moon can use them for crater rings
// without pulling in a separate jsm import path.
export { Line2, LineMaterial };

/**
 * Push overlapping post labels apart by adjusting their lineLengthMult.
 * Operates in-place. Identical algorithm used by both Globe and Moon.
 */
export function resolveOverlaps(postObjects: PostObjectBase[], overlapThresh: number): void {
  const visible = postObjects.filter((p) => p.progress > 0 && p.lagX !== null);
  for (let i = 0; i < visible.length; i++) {
    const a = visible[i];
    for (let j = i + 1; j < visible.length; j++) {
      const b = visible[j];
      const ddx = a.lagX! - b.lagX!;
      const ddy = a.lagY! - b.lagY!;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < overlapThresh) {
        if (a.progress >= b.progress) {
          a.lineLengthMult += (1.0 - a.lineLengthMult) * 0.06;
          b.lineLengthMult += (1.7 - b.lineLengthMult) * 0.06;
        } else {
          b.lineLengthMult += (1.0 - b.lineLengthMult) * 0.06;
          a.lineLengthMult += (1.7 - a.lineLengthMult) * 0.06;
        }
      } else {
        a.lineLengthMult += (1.0 - a.lineLengthMult) * 0.03;
        b.lineLengthMult += (1.0 - b.lineLengthMult) * 0.03;
      }
    }
  }
}
