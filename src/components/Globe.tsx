import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Wireframe } from "three/examples/jsm/lines/Wireframe.js";
import { WireframeGeometry2 } from "three/examples/jsm/lines/WireframeGeometry2.js";
import { CONTINENT_OUTLINES } from "@/lib/globe-data";
import type { FeedPost } from "@/hooks/useFeed";
import { useIsMobile } from "@/hooks/use-mobile";
import { getTagColor, normalizeTag } from "@/lib/tag-colors";

const RADIUS = 1.0;
const LINE_MAX = 80;
const EASE = 0.065;
const LAG_SPEED = 0.045;
const OVERLAP_THRESH = 55;
const WINDOW_SIZE = 10;
const MOBILE_SCALE = 0.67;
const DESKTOP_SCALE = 1.1;

function projectPoint(lat: number, lon: number, r: number): THREE.Vector3 {
  const latR = lat * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.cos(latR) * Math.cos(theta),
    r * Math.sin(latR),
    r * Math.cos(latR) * Math.sin(theta),
  );
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function normalizeAngle(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function getRotationForCenteredLongitude(lon: number) {
  // With this globe projection, front-center longitude is: lon = -90° - rotationY(deg)
  // => rotationY needed to center a longitude is -(lon + 90°)
  return -(lon + 90) * (Math.PI / 180);
}

interface PostObject {
  localPos: THREE.Vector3;
  dot: THREE.Mesh;
  el: HTMLDivElement;
  originEl: HTMLDivElement;
  data: FeedPost;
  progress: number;
  lagX: number | null;
  lagY: number | null;
  _drawnX: number;
  _drawnY: number;
  lineLengthMult: number;
  isHidden: boolean;
  facing: number;
  dateIndex: number;
  tagColorRgb: [number, number, number];
}

interface GlobeProps {
  posts: FeedPost[];
  onPostClick: (post: FeedPost) => void;
  paused?: boolean;
  onNeedMore?: () => void;
  selectedPostId?: string | null;
  spinToLon?: number | null;
  onVisiblePostsChange?: (visiblePosts: FeedPost[]) => void;
}

export default function Globe({
  posts,
  onPostClick,
  paused,
  onNeedMore,
  selectedPostId,
  spinToLon,
  onVisiblePostsChange,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    spinGroup: THREE.Group;
    tiltGroup: THREE.Group;
    postObjects: PostObject[];
  } | null>(null);
  const dragRef = useRef({
    isDragging: false,
    dragMoved: false,
    rotVel: 0,
    autoRotate: true,
    arTimer: null as ReturnType<typeof setTimeout> | null,
    prevX: 0,
    prevY: 0,
    lastRotY: 0,
    dragAxis: null as "h" | "v" | null,
    vertVel: 0,
    pinchDist: 0,
    isPinching: false,
  });
  const windowCursorRef = useRef(0);
  const rotAccumRef = useRef(0);
  const spinToLonRef = useRef<number | null>(null);
  const onVisiblePostsChangeRef = useRef(onVisiblePostsChange);
  onVisiblePostsChangeRef.current = onVisiblePostsChange;
  const isMobile = useIsMobile();

  const postsRef = useRef(posts);
  postsRef.current = posts;
  const onPostClickRef = useRef(onPostClick);
  onPostClickRef.current = onPostClick;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onNeedMoreRef = useRef(onNeedMore);
  onNeedMoreRef.current = onNeedMore;
  const selectedPostIdRef = useRef(selectedPostId);
  selectedPostIdRef.current = selectedPostId;

  // Handle spinToLon changes
  useEffect(() => {
    if (spinToLon !== null && spinToLon !== undefined) {
      spinToLonRef.current = spinToLon;
    }
  }, [spinToLon]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.tiltGroup.scale.setScalar(isMobile ? MOBILE_SCALE : DESKTOP_SCALE);
  }, [isMobile]);

  const W = useCallback(() => window.innerWidth, []);
  const H = useCallback(() => window.innerHeight, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const overlayCanvas = overlayRef.current!;
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
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 1000);
    camera.position.set(0, 0, 3.8);
    camera.lookAt(0, 0, 0);

    // Depth mask — writes z-buffer, invisible
    const solidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 0.997, 64, 48),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
    );

    // Visible surface at 30% opacity — deep navy/ocean blue
    const surfaceMesh = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 0.995, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x071428,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );

    // Thick wireframe lattice using Line2 (WebGL-compatible thick lines)
    const wireMat = new LineMaterial({
      color: 0x1a4aff,
      linewidth: 0.4,
      transparent: true,
      opacity: 0.26,
      resolution: new THREE.Vector2(W(), H()),
    });
    const wireMesh = new Wireframe(
      new WireframeGeometry2(new THREE.SphereGeometry(RADIUS * 1.001, 36, 24)),
      wireMat,
    );
    wireMesh.computeLineDistances();

    // Thick continent outlines using Line2
    const outlineMat = new LineMaterial({
      color: 0x1a4aff,
      linewidth: 0.8,
      transparent: true,
      opacity: 0.864,
      resolution: new THREE.Vector2(W(), H()),
    });
    const outlineGroup = new THREE.Group();
    CONTINENT_OUTLINES.forEach((coords) => {
      const pts = coords.map(([lo, la]) =>
        projectPoint(la, lo, RADIUS * 1.003),
      );
      pts.push(pts[0].clone());
      const geo = new LineGeometry();
      geo.setPositions(pts.flatMap((v) => [v.x, v.y, v.z]));
      outlineGroup.add(new Line2(geo, outlineMat));
    });

    const spinGroup = new THREE.Group();
    spinGroup.add(solidMesh, wireMesh, outlineGroup);

    const tiltGroup = new THREE.Group();
    tiltGroup.add(spinGroup);
    tiltGroup.rotation.x = 0.35;
    tiltGroup.scale.setScalar(
      window.innerWidth < 768 ? MOBILE_SCALE : DESKTOP_SCALE,
    );
    scene.add(tiltGroup);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      spinGroup,
      tiltGroup,
      postObjects: [],
    };

    function resize() {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      overlayCanvas.width = W();
      overlayCanvas.height = H();
      wireMat.resolution.set(W(), H());
      outlineMat.resolution.set(W(), H());
    }
    window.addEventListener("resize", resize);
    resize();

    const drag = dragRef.current;
    const AXIS_THRESHOLD = 5;

    function onMouseDown(e: MouseEvent) {
      drag.isDragging = true;
      drag.dragMoved = false;
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
        drag.dragMoved = true;
      }

      if (drag.dragAxis === "h") {
        drag.rotVel = Math.max(-0.1, Math.min(0.1, dx * 0.008));
        spinGroup.rotation.y += drag.rotVel;
      } else {
        const newTilt = tiltGroup.rotation.x + dy * 0.005;
        tiltGroup.rotation.x = Math.max(-0.35, Math.min(0.35, newTilt));
        drag.vertVel = dy * 0.005;
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
    function getPinchDist(e: TouchEvent) {
      const t = e.touches;
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        // Pinch zoom disabled on mobile
        return;
      }
      drag.isDragging = true;
      drag.dragMoved = false;
      drag.dragAxis = null;
      drag.prevX = e.touches[0].clientX;
      drag.prevY = e.touches[0].clientY;
      if (drag.arTimer) clearTimeout(drag.arTimer);
      drag.autoRotate = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) {
        return;
      }

      if (!drag.isDragging) return;
      const dx = e.touches[0].clientX - drag.prevX;
      const dy = e.touches[0].clientY - drag.prevY;

      if (!drag.dragAxis) {
        if (Math.abs(dx) > AXIS_THRESHOLD) drag.dragAxis = "h";
        else if (Math.abs(dy) > AXIS_THRESHOLD) drag.dragAxis = "v";
        else return;
        drag.dragMoved = true;
      }

      if (drag.dragAxis === "h") {
        drag.rotVel = Math.max(-0.1, Math.min(0.1, dx * 0.008));
        spinGroup.rotation.y += drag.rotVel;
      } else {
        const newTilt = tiltGroup.rotation.x + dy * 0.005;
        tiltGroup.rotation.x = Math.max(-0.35, Math.min(0.35, newTilt));
        drag.vertVel = dy * 0.005;
      }
      drag.prevX = e.touches[0].clientX;
      drag.prevY = e.touches[0].clientY;
    }
    function onTouchEnd() {
      drag.isPinching = false;
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

    const _prj = new THREE.Vector3();
    function toScreen(worldV3: THREE.Vector3) {
      _prj.copy(worldV3).project(camera);
      return {
        x: (_prj.x * 0.5 + 0.5) * W(),
        y: (-_prj.y * 0.5 + 0.5) * H(),
      };
    }

    const _wPos = new THREE.Vector3();
    const _nrm = new THREE.Vector3();
    const _mat3 = new THREE.Matrix3();
    const _toCam = new THREE.Vector3();

    const ROT_PER_SHIFT = 0.5;

    function drawOverlay() {
      const s = sceneRef.current;
      if (!s) return;
      ctx2d.clearRect(0, 0, W(), H());
      _mat3.getNormalMatrix(spinGroup.matrixWorld);

      const totalPosts = s.postObjects.length;
      if (totalPosts === 0) return;

      const currentRotY = spinGroup.rotation.y;
      const rotDelta = currentRotY - drag.lastRotY;
      drag.lastRotY = currentRotY;

      if (drag.isDragging || Math.abs(drag.rotVel) > 0.003) {
        rotAccumRef.current += rotDelta;
      }

      if (Math.abs(rotAccumRef.current) >= ROT_PER_SHIFT) {
        const shifts = Math.floor(
          Math.abs(rotAccumRef.current) / ROT_PER_SHIFT,
        );
        if (rotAccumRef.current > 0) {
          windowCursorRef.current -= shifts;
        } else {
          windowCursorRef.current += shifts;
        }
        rotAccumRef.current = rotAccumRef.current % ROT_PER_SHIFT;
        windowCursorRef.current =
          ((windowCursorRef.current % totalPosts) + totalPosts) % totalPosts;

        if (windowCursorRef.current + WINDOW_SIZE >= totalPosts - 5) {
          onNeedMoreRef.current?.();
        }
      }

      const visibleIndices = new Set<number>();
      for (let i = 0; i < Math.min(WINDOW_SIZE, totalPosts); i++) {
        visibleIndices.add((windowCursorRef.current + i) % totalPosts);
      }

      // Also keep selected post visible
      const selId = selectedPostIdRef.current;

      s.postObjects.forEach((p) => {
        const isSelected = selId === p.data.id;
        p.isHidden = !visibleIndices.has(p.dateIndex) && !isSelected;
      });

      // Report visible (non-hidden, front-facing) posts to parent
      const visiblePosts = s.postObjects
        .filter((p) => !p.isHidden && p.facing > -0.1)
        .map((p) => p.data);
      onVisiblePostsChangeRef.current?.(visiblePosts);

      s.postObjects.forEach((p) => {
        if (p.isHidden && p.progress <= 0) {
          p.el.style.display = "none";
          p.originEl.style.display = "none";
          return;
        }

        _wPos.copy(p.localPos).applyMatrix4(spinGroup.matrixWorld);
        _nrm.copy(p.localPos).normalize().applyMatrix3(_mat3).normalize();

        _toCam.copy(camera.position).sub(_wPos).normalize();
        const facing = _toCam.dot(_nrm);
        p.facing = facing;

        let targetVis: number;
        if (p.isHidden) {
          targetVis = 0;
        } else {
          targetVis = Math.max(0, Math.min(1, (facing + 0.1) / 0.2));
        }

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

        const sp = toScreen(_wPos);
        const eased = easeInOut(prog);
        (p.dot.material as THREE.MeshBasicMaterial).opacity = Math.min(
          0.45,
          prog * 1.5,
        );

        // Position the pulsating origin dot at the projected post location on the globe surface
        const originAlpha = Math.max(0, Math.min(1, (facing + 0.05) / 0.25));
        if (originAlpha > 0.02) {
          p.originEl.style.display = "block";
          p.originEl.style.left = sp.x + "px";
          p.originEl.style.top = sp.y + "px";
          p.originEl.style.opacity = String(originAlpha);
        } else {
          p.originEl.style.display = "none";
        }

        const normalWorld = _nrm.clone();
        const tipWorld = _wPos
          .clone()
          .add(normalWorld.clone().multiplyScalar(0.18));
        const spTip = toScreen(tipWorld);
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

        // Determine if this post is selected
        const isSelected = selId === p.data.id;

        const [tr, tg, tb] = p.tagColorRgb;
        if (eased > 0.01) {
          ctx2d.beginPath();
          ctx2d.moveTo(Math.round(sp.x), Math.round(sp.y));
          ctx2d.lineTo(Math.round(midX), Math.round(midY));
          ctx2d.strokeStyle = isSelected
            ? `rgba(${tr},${tg},${tb},${0.95 * eased})`
            : `rgba(${tr},${tg},${tb},${0.55 * eased})`;
          ctx2d.lineWidth = isSelected ? 2 : 1.3;
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

          // Highlight selected post
          if (isSelected) {
            p.el.classList.add("post-dot-selected");
          } else {
            p.el.classList.remove("post-dot-selected");
          }
        } else {
          p.el.style.display = "none";
        }
      });

      const visible = s.postObjects.filter(
        (p) => p.progress > 0 && p.lagX !== null,
      );
      for (let i = 0; i < visible.length; i++) {
        const a = visible[i];
        for (let j = i + 1; j < visible.length; j++) {
          const b = visible[j];
          const ddx = a.lagX! - b.lagX!;
          const ddy = a.lagY! - b.lagY!;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < OVERLAP_THRESH) {
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

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);

      // Handle spinToLon — smoothly rotate to target longitude
      if (spinToLonRef.current !== null) {
        // Map longitude to the exact Y-rotation that puts that longitude at front-center
        const targetRotY = getRotationForCenteredLongitude(
          spinToLonRef.current,
        );
        const diff = normalizeAngle(targetRotY - spinGroup.rotation.y);

        if (Math.abs(diff) < 0.005) {
          spinGroup.rotation.y += diff;
          spinToLonRef.current = null;
        } else {
          spinGroup.rotation.y += diff * 0.05;
        }

        drag.autoRotate = false;
        if (drag.arTimer) clearTimeout(drag.arTimer);
        drag.arTimer = setTimeout(() => {
          drag.autoRotate = true;
        }, 3500);
      } else if (!pausedRef.current && drag.autoRotate && !drag.isDragging) {
        spinGroup.rotation.y -= 0.0009;
      } else if (!pausedRef.current && !drag.isDragging) {
        drag.rotVel *= 0.92;
        spinGroup.rotation.y += drag.rotVel;
      }
      renderer.render(scene, camera);
      drawOverlay();
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      themeObs.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      renderer.dispose();
    };
  }, []);

  // Update post objects when posts change
  useEffect(() => {
    const s = sceneRef.current;
    const dotsContainer = dotsRef.current;
    if (!s || !dotsContainer) return;

    s.postObjects.forEach((p) => {
      p.el.style.display = "none";
      p.originEl.style.display = "none";
      s.spinGroup.remove(p.dot);
      p.el.remove();
      p.originEl.remove();
    });
    const overlayCanvas = overlayRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext("2d");
      ctx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    const sorted = [...posts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    s.postObjects = sorted.map((post, dateIndex) => {
      const localPos = projectPoint(post.lat, post.lon, RADIUS);
      const tagColor = getTagColor(post.tag, post.type);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.007, 8, 8),
        new THREE.MeshBasicMaterial({
          color: tagColor.hexNum,
          transparent: true,
          opacity: 0,
        }),
      );
      dot.position.copy(localPos);
      s.spinGroup.add(dot);

      const el = document.createElement("div");
      el.className = "post-dot type-" + post.type;
      el.style.display = "none";
      el.style.opacity = "0";
      el.style.setProperty("--tag-color", tagColor.hex);

      const normalizedTag = normalizeTag(post.tag, post.type);
      const tagLabel = `[${normalizedTag}]`;
      if (post.type === "photo") {
        const snippet =
          (post.caption || "").split(" ").slice(0, 4).join(" ") + "…";
        el.innerHTML = `<div class="font-mono-ui" style="font-size:0.44rem;letter-spacing:0.12em;text-transform:uppercase;color:${tagColor.hex};text-align:center">${tagLabel}</div><div style="font-size:0.66rem;font-style:italic;color:hsl(var(--muted-foreground));white-space:nowrap;max-width:78px;overflow:hidden;text-overflow:ellipsis;text-align:center">${snippet}</div>`;
      } else if (post.type === "audio") {
        const bars = Array.from({ length: 7 }, () => {
          const dur = (0.35 + Math.random() * 0.5).toFixed(2);
          const del = (Math.random() * 0.4).toFixed(2);
          return `<div class="voice-bar" style="--dur:${dur}s;animation-delay:${del}s"></div>`;
        }).join("");
        el.innerHTML = `<div class="font-mono-ui" style="font-size:0.42rem;letter-spacing:0.1em;text-transform:uppercase;color:${tagColor.hex};line-height:1;text-align:center">${tagLabel}</div><div class="voice-bars">${bars}</div>`;
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onPostClickRef.current(post);
      });

      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        spinToLonRef.current = post.lon;
      });

      dotsContainer.appendChild(el);

      // Pulsating origin dot — pinned to the projected post location
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
        _drawnX: 0,
        _drawnY: 0,
        lineLengthMult: 1.0,
        isHidden: true,
        facing: 0,
        dateIndex,
        tagColorRgb: tagColor.rgb,
      };
    });

    windowCursorRef.current = 0;
    rotAccumRef.current = 0;
  }, [posts]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full z-[1]"
        style={{ cursor: "grab" }}
      />
      <canvas
        ref={overlayRef}
        className="fixed inset-0 pointer-events-none z-[5]"
      />
      <div ref={dotsRef} className="fixed inset-0 pointer-events-none z-[10]" />
    </>
  );
}
