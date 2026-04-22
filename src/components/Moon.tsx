import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import type { FeedPost } from "@/hooks/useFeed";
import { getTagColor, normalizeTag } from "@/lib/tag-colors";
import { RADIUS, MOON_EASE as EASE, MOON_LAG_SPEED as LAG_SPEED, MOON_OVERLAP_THRESH as OVERLAP_THRESH } from "@/lib/scene-constants";
import { projectPoint, easeInOut, resolveOverlaps, createDepthMask, createSurfaceMesh, createWireframeMesh, Line2, LineMaterial, type PostObjectBase } from "@/lib/sphere-utils";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";

const LINE_MAX = 75;
const MOON_COLOR = 0x4a5060; // dark slate grey

// Generate a small-circle on the sphere surface for a crater ring
function craterCircle(
  lat: number,
  lon: number,
  angularRadiusDeg: number,
  r: number,
  segments = 48,
): THREE.Vector3[] {
  const angR = angularRadiusDeg * (Math.PI / 180);
  const center = projectPoint(lat, lon, 1.0).normalize();

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

// Realistic crater / mare distribution
const MOON_CRATERS: Array<{
  lat: number;
  lon: number;
  r: number;
  segs?: number;
}> = [
  // Large maria / impact basins
  { lat: 33, lon: -17, r: 8, segs: 64 },
  { lat: 28, lon: 17, r: 5, segs: 56 },
  { lat: 8, lon: 31, r: 6, segs: 56 },
  { lat: 45, lon: 0, r: 4.5 },
  { lat: -20, lon: 30, r: 5.5, segs: 56 },
  { lat: 15, lon: -50, r: 5 },
  // Medium craters
  { lat: -43, lon: -11, r: 3.5 },
  { lat: 10, lon: -20, r: 3 },
  { lat: 50, lon: -40, r: 2.5 },
  { lat: -60, lon: 100, r: 4 },
  { lat: 20, lon: 60, r: 2.5 },
  { lat: -30, lon: -80, r: 3 },
  { lat: 35, lon: 55, r: 2 },
  { lat: -10, lon: -45, r: 2.5 },
  { lat: -50, lon: 30, r: 2 },
  { lat: 60, lon: 80, r: 3 },
  { lat: -70, lon: -60, r: 2.5 },
  { lat: 5, lon: -80, r: 2 },
  { lat: 45, lon: -110, r: 2.5 },
  { lat: -40, lon: 140, r: 2.5 },
  // Small craters scattered across surface
  { lat: 25, lon: -30, r: 1.5 },
  { lat: -15, lon: 15, r: 1.5 },
  { lat: 40, lon: -70, r: 1.5 },
  { lat: -25, lon: 65, r: 1.5 },
  { lat: 55, lon: 30, r: 1.2 },
  { lat: -35, lon: -40, r: 1.5 },
  { lat: 15, lon: 80, r: 1.5 },
  { lat: -55, lon: -80, r: 1.8 },
  { lat: 70, lon: -20, r: 1.5 },
  { lat: -5, lon: 55, r: 1.2 },
  { lat: 20, lon: 130, r: 1.5 },
  { lat: -20, lon: -120, r: 1.5 },
  { lat: 60, lon: -150, r: 2 },
  { lat: -60, lon: -150, r: 2 },
  { lat: 10, lon: 160, r: 1.5 },
  { lat: -10, lon: -160, r: 1.5 },
  { lat: 75, lon: 60, r: 1.5 },
  { lat: -75, lon: 30, r: 1.8 },
  { lat: 30, lon: -100, r: 1.5 },
  { lat: -30, lon: 100, r: 1.5 },
];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}


interface MoonProps {
  posts: FeedPost[];
  onPostClick?: (post: FeedPost) => void;
}

export default function Moon({ posts, onPostClick }: MoonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const onPostClickRef = useRef(onPostClick);
  onPostClickRef.current = onPostClick;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const overlayCanvas = overlayRef.current!;
    const dotsContainer = dotsRef.current!;
    const ctx2d = overlayCanvas.getContext("2d")!;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const updateBg = () => {
      const dark = document.documentElement.classList.contains("dark");
      renderer.setClearColor(dark ? 0x141414 : 0xf5f0e8, 0.5);
    };
    updateBg();
    const themeObs = new MutationObserver(updateBg);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 3.6);
    camera.lookAt(0, 0, 0);

    const solidMesh = createDepthMask();
    const surfaceMesh = createSurfaceMesh(0x12151a);
    const { mesh: wireMesh, material: wireMat } = createWireframeMesh({
      color: MOON_COLOR,
      linewidth: 0.3,
      opacity: 0.2,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    // 3D crater outlines — uniform dark-grey palette, brightness contrast creates depth
    const rimMat = new LineMaterial({
      color: 0x737d8c, // medium-dark grey — raised rim, slightly brighter
      linewidth: 0.6,
      transparent: true,
      opacity: 0.8,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });
    const bowlMat = new LineMaterial({
      color: 0x2e3340, // deep dark grey — shadowed bowl interior
      linewidth: 0.4,
      transparent: true,
      opacity: 0.65,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });
    const peakMat = new LineMaterial({
      color: 0x5c6470, // dark grey mid-tone — central peak
      linewidth: 0.3,
      transparent: true,
      opacity: 0.55,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    const craterGroup = new THREE.Group();
    MOON_CRATERS.forEach(({ lat, lon, r: angR, segs }) => {
      const segments = segs ?? 48;

      // Outer rim — slightly raised above the sphere surface
      const rimPts = craterCircle(lat, lon, angR, RADIUS * 1.004, segments);
      const rimGeo = new LineGeometry();
      rimGeo.setPositions(rimPts.flatMap((v) => [v.x, v.y, v.z]));
      const rimLine = new Line2(rimGeo, rimMat);
      rimLine.computeLineDistances();
      craterGroup.add(rimLine);

      // Inner bowl — slightly recessed, dark to suggest shadow depth
      if (angR >= 1.0) {
        const innerSegs = Math.max(24, Math.floor(segments * 0.65));
        const bowlPts = craterCircle(lat, lon, angR * 0.58, RADIUS * 0.999, innerSegs);
        const bowlGeo = new LineGeometry();
        bowlGeo.setPositions(bowlPts.flatMap((v) => [v.x, v.y, v.z]));
        const bowlLine = new Line2(bowlGeo, bowlMat);
        bowlLine.computeLineDistances();
        craterGroup.add(bowlLine);
      }

      // Central peak — only large craters have this feature
      if (angR >= 4.0) {
        const peakPts = craterCircle(lat, lon, angR * 0.12, RADIUS * 1.002, 20);
        const peakGeo = new LineGeometry();
        peakGeo.setPositions(peakPts.flatMap((v) => [v.x, v.y, v.z]));
        const peakLine = new Line2(peakGeo, peakMat);
        peakLine.computeLineDistances();
        craterGroup.add(peakLine);
      }
    });

    const moonGroup = new THREE.Group();
    moonGroup.add(solidMesh, surfaceMesh, wireMesh, craterGroup);
    moonGroup.rotation.x = 0.35;
    scene.add(moonGroup);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      overlayCanvas.width = w;
      overlayCanvas.height = h;
      wireMat.resolution.set(w, h);
      rimMat.resolution.set(w, h);
      bowlMat.resolution.set(w, h);
      peakMat.resolution.set(w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Drag to rotate — mirrors Globe drag (axis locking, mouse+touch, inertia)
    const AXIS_THRESHOLD = 5;
    const drag = {
      isDragging: false,
      dragAxis: null as "h" | "v" | null,
      prevX: 0,
      prevY: 0,
      rotVel: 0,
      autoRotate: true,
      arTimer: null as ReturnType<typeof setTimeout> | null,
    };

    function onMouseDown(e: MouseEvent) {
      drag.isDragging = true;
      drag.dragAxis = null;
      drag.prevX = e.clientX;
      drag.prevY = e.clientY;
      if (drag.arTimer) clearTimeout(drag.arTimer);
      drag.autoRotate = false;
    }
    function onMouseMove(e: MouseEvent) {
      if (!drag.isDragging) return;
      const dx = e.clientX - drag.prevX;
      const dy = e.clientY - drag.prevY;
      if (!drag.dragAxis) {
        if (Math.abs(dx) > AXIS_THRESHOLD) drag.dragAxis = "h";
        else if (Math.abs(dy) > AXIS_THRESHOLD) drag.dragAxis = "v";
        else return;
      }
      if (drag.dragAxis === "h") {
        drag.rotVel = Math.max(-0.1, Math.min(0.1, dx * 0.008));
        moonGroup.rotation.y += drag.rotVel;
      } else {
        moonGroup.rotation.x = Math.max(
          -0.35,
          Math.min(0.35, moonGroup.rotation.x + dy * 0.005),
        );
      }
      drag.prevX = e.clientX;
      drag.prevY = e.clientY;
    }
    function onMouseUp() {
      if (!drag.isDragging) return;
      drag.isDragging = false;
      drag.dragAxis = null;
      drag.arTimer = setTimeout(() => {
        drag.autoRotate = true;
      }, 3500);
    }
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      drag.isDragging = true;
      drag.dragAxis = null;
      drag.prevX = e.touches[0].clientX;
      drag.prevY = e.touches[0].clientY;
      if (drag.arTimer) clearTimeout(drag.arTimer);
      drag.autoRotate = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (!drag.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - drag.prevX;
      const dy = e.touches[0].clientY - drag.prevY;
      if (!drag.dragAxis) {
        if (Math.abs(dx) > AXIS_THRESHOLD) drag.dragAxis = "h";
        else if (Math.abs(dy) > AXIS_THRESHOLD) drag.dragAxis = "v";
        else return;
      }
      if (drag.dragAxis === "h") {
        drag.rotVel = Math.max(-0.1, Math.min(0.1, dx * 0.008));
        moonGroup.rotation.y += drag.rotVel;
      } else {
        moonGroup.rotation.x = Math.max(
          -0.35,
          Math.min(0.35, moonGroup.rotation.x + dy * 0.005),
        );
      }
      drag.prevX = e.touches[0].clientX;
      drag.prevY = e.touches[0].clientY;
    }
    function onTouchEnd() {
      drag.isDragging = false;
      drag.dragAxis = null;
      drag.arTimer = setTimeout(() => {
        drag.autoRotate = true;
      }, 3500);
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    // Build post objects
    const postObjects: PostObjectBase[] = posts.map((post) => {
      const localPos = projectPoint(post.lat, post.lon, RADIUS);
      const tagColor = getTagColor(post.tag, post.type);
      const normalizedTag = normalizeTag(post.tag, post.type);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.007, 8, 8),
        new THREE.MeshBasicMaterial({
          color: tagColor.hexNum,
          transparent: true,
          opacity: 0,
        }),
      );
      dot.position.copy(localPos);
      moonGroup.add(dot);

      const el = document.createElement("div");
      el.className =
        post.type === "audio"
          ? "post-dot type-audio moon-audio"
          : "post-dot type-photo";
      el.style.display = "none";
      el.style.opacity = "0";
      el.style.setProperty("--tag-color", tagColor.hex);

      const dateStr = shortDate(post.createdAt);
      const locationStr = post.location || "";

      if (post.type === "photo") {
        el.innerHTML = `<div class="font-mono-ui" style="font-size:0.44rem;letter-spacing:0.12em;text-transform:uppercase;color:${tagColor.hex};text-align:center">[${normalizedTag}]</div><div style="font-size:0.58rem;font-style:italic;color:hsl(var(--muted-foreground));white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;text-align:center">${locationStr}</div><div class="font-mono-ui" style="font-size:0.40rem;letter-spacing:0.08em;text-transform:uppercase;color:hsl(var(--muted-foreground));text-align:center">${dateStr}</div>`;
      } else {
        el.innerHTML = `<div class="font-mono-ui" style="font-size:0.42rem;letter-spacing:0.1em;text-transform:uppercase;color:${tagColor.hex};text-align:center;line-height:1">[${normalizedTag}]</div><div style="font-size:0.5rem;font-style:italic;color:hsl(var(--muted-foreground));white-space:nowrap;max-width:50px;overflow:hidden;text-overflow:ellipsis;text-align:center;line-height:1.4">${locationStr}</div><div class="font-mono-ui" style="font-size:0.38rem;letter-spacing:0.08em;text-transform:uppercase;color:hsl(var(--muted-foreground));text-align:center;line-height:1">${dateStr}</div>`;
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onPostClickRef.current?.(post);
      });
      dotsContainer.appendChild(el);

      // Pulsating surface origin dot
      const originEl = document.createElement("div");
      originEl.className = "globe-origin-dot";
      originEl.style.display = "none";
      originEl.style.setProperty("--tag-color", tagColor.hex);
      dotsContainer.appendChild(originEl);

      return {
        localPos,
        dot,
        el,
        originEl,
        data: post,
        progress: 0,
        lagX: null,
        lagY: null,
        lineLengthMult: 1.0,
        facing: 0,
        tagColorRgb: tagColor.rgb,
      };
    });

    const _world = new THREE.Vector3();
    const _nrm = new THREE.Vector3();
    const _toCam = new THREE.Vector3();
    const _mat3 = new THREE.Matrix3();
    const _prj = new THREE.Vector3();

    function toScreen(worldV3: THREE.Vector3, rect: DOMRect) {
      _prj.copy(worldV3).project(camera);
      return {
        x: (_prj.x * 0.5 + 0.5) * rect.width,
        y: (-_prj.y * 0.5 + 0.5) * rect.height,
      };
    }

    function drawOverlay() {
      const rect = canvas.getBoundingClientRect();
      ctx2d.clearRect(0, 0, rect.width, rect.height);
      _mat3.getNormalMatrix(moonGroup.matrixWorld);

      postObjects.forEach((p) => {
        _world.copy(p.localPos).applyMatrix4(moonGroup.matrixWorld);
        _nrm.copy(p.localPos).normalize().applyMatrix3(_mat3).normalize();
        _toCam.copy(camera.position).sub(_world).normalize();
        const facing = _toCam.dot(_nrm);
        p.facing = facing;

        const targetVis = Math.max(0, Math.min(1, (facing + 0.1) / 0.2));
        p.progress += (targetVis - p.progress) * EASE;
        if (p.progress < 0.003) p.progress = 0;
        if (p.progress > 0.997) p.progress = 1;

        const prog = p.progress;

        if (prog <= 0) {
          p.el.style.display = "none";
          p.originEl.style.display = "none";
          (p.dot.material as THREE.MeshBasicMaterial).opacity = 0;
          p.lagX = null;
          p.lagY = null;
          return;
        }

        const sp = toScreen(_world, rect);
        const eased = easeInOut(prog);
        (p.dot.material as THREE.MeshBasicMaterial).opacity = Math.min(
          0.45,
          prog * 1.5,
        );

        const originAlpha = Math.max(0, Math.min(1, (facing + 0.05) / 0.25));
        if (originAlpha > 0.02) {
          p.originEl.style.display = "block";
          p.originEl.style.left = sp.x + "px";
          p.originEl.style.top = sp.y + "px";
          p.originEl.style.opacity = String(originAlpha);
        } else {
          p.originEl.style.display = "none";
        }

        // Line tip direction — project the surface normal outward
        const normalWorld = _nrm.clone();
        const tipWorld = _world.clone().add(normalWorld.multiplyScalar(0.18));
        const spTip = toScreen(tipWorld, rect);
        let ndx = spTip.x - sp.x;
        let ndy = spTip.y - sp.y;
        const nlen = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
        ndx /= nlen;
        ndy /= nlen;

        const targetX = sp.x + ndx * LINE_MAX * p.lineLengthMult;
        const targetY = sp.y + ndy * LINE_MAX * p.lineLengthMult;

        if (p.lagX === null) {
          p.lagX = sp.x;
          p.lagY = sp.y - 10;
        }
        p.lagX += (targetX - p.lagX) * LAG_SPEED;
        p.lagY! += (targetY - p.lagY!) * LAG_SPEED;

        const dx = p.lagX - sp.x;
        const dy = p.lagY! - sp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = LINE_MAX * 1.6;
        let ex = p.lagX,
          ey = p.lagY!;
        if (dist > maxDist) {
          ex = sp.x + (dx / dist) * maxDist;
          ey = sp.y + (dy / dist) * maxDist;
          p.lagX = ex;
          p.lagY = ey;
        }

        const midX = sp.x + (ex - sp.x) * eased;
        const midY = sp.y + (ey - sp.y) * eased;

        const [tr, tg, tb] = p.tagColorRgb;
        if (eased > 0.01) {
          ctx2d.beginPath();
          ctx2d.moveTo(Math.round(sp.x), Math.round(sp.y));
          ctx2d.lineTo(Math.round(midX), Math.round(midY));
          ctx2d.strokeStyle = `rgba(${tr},${tg},${tb},${0.55 * eased})`;
          ctx2d.lineWidth = 1.3;
          ctx2d.stroke();
        }

        const dotFadeStart = 0.55;
        if (prog > dotFadeStart) {
          const dotAlpha = Math.min(1, (prog - dotFadeStart) / 0.25);
          p.el.style.display = "block";
          p.el.style.left = midX + "px";
          p.el.style.top = midY + "px";
          p.el.style.opacity = String(dotAlpha);
          p.el.style.pointerEvents = dotAlpha > 0.4 ? "all" : "none";
        } else {
          p.el.style.display = "none";
        }
      });

      resolveOverlaps(postObjects, OVERLAP_THRESH);
    }

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      if (drag.autoRotate && !drag.isDragging) {
        moonGroup.rotation.y += 0.0015;
      } else if (!drag.isDragging) {
        drag.rotVel *= 0.92;
        moonGroup.rotation.y += drag.rotVel;
      }

      renderer.render(scene, camera);
      drawOverlay();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      themeObs.disconnect();
      ro.disconnect();
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      postObjects.forEach(({ el, originEl, dot }) => {
        el.remove();
        originEl.remove();
        (dot.material as THREE.MeshBasicMaterial).dispose();
        dot.geometry.dispose();
      });
      solidMesh.geometry.dispose();
      (solidMesh.material as THREE.MeshBasicMaterial).dispose();
      wireMesh.geometry.dispose();
      wireMat.dispose();
      rimMat.dispose();
      bowlMat.dispose();
      peakMat.dispose();
      craterGroup.children.forEach((child) => {
        (child as Line2).geometry.dispose();
      });
      renderer.dispose();
    };
  }, [posts]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: "grab" }}
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
      />
      <div
        ref={dotsRef}
        className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto"
      />
    </div>
  );
}
