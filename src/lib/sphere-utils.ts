import * as THREE from "three";
import type { FeedPost } from "@/hooks/useFeed";

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
