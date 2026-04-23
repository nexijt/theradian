import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { CONTINENT_OUTLINES, GLOBE_LABELS } from "@/lib/globe-data";
import type { FeedPost } from "@/hooks/useFeed";
import { useIsMobile } from "@/hooks/use-mobile";
import { getTagColor, normalizeTag } from "@/lib/tag-colors";
import {
  RADIUS,
  GLOBE_EASE as EASE,
  GLOBE_LAG_SPEED as LAG_SPEED,
} from "@/lib/scene-constants";
import {
  projectPoint,
  easeInOut,
  createDepthMask,
  createSurfaceMesh,
  createWireframeMesh,
} from "@/lib/sphere-utils";
import { buildClusters, type Cluster } from "@/lib/cluster-utils";

const LINE_MAX = 80;
const WINDOW_SIZE = 10;
const MOBILE_SCALE = 0.67;
const DESKTOP_SCALE = 1.1;
const CLUSTER_THRESH_DEG = 0.5;
// Angle (radians) between adjacent fan items
const FAN_SPREAD = 22 * (Math.PI / 180);
// How far fan items extend from the surface point (px)
const FAN_LENGTH = LINE_MAX * 1.25;

function normalizeAngle(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function getRotationForCenteredLongitude(lon: number) {
  return -(lon + 90) * (Math.PI / 180);
}

interface ClusterObject {
  localPos: THREE.Vector3;
  dot: THREE.Mesh;
  el: HTMLDivElement;
  originEl: HTMLDivElement;
  cluster: Cluster;
  progress: number;
  lagX: number | null;
  lagY: number | null;
  facing: number;
  dateIndex: number;
  tagColorRgb: [number, number, number];
  _drawnX: number;
  _drawnY: number;
  isHidden: boolean;
  // Fan state (only used for "small" clusters)
  isExpanded: boolean;
  fanProgress: number;
  fanEls: HTMLDivElement[];
}

interface GlobeProps {
  posts: FeedPost[];
  onPostClick: (post: FeedPost) => void;
  onClusterClick?: (posts: FeedPost[]) => void;
  paused?: boolean;
  onNeedMore?: () => void;
  selectedPostId?: string | null;
  spinToLon?: number | null;
  onVisiblePostsChange?: (visiblePosts: FeedPost[]) => void;
}

export default function Globe({
  posts,
  onPostClick,
  onClusterClick,
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
    clusterObjects: ClusterObject[];
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
  const onClusterClickRef = useRef(onClusterClick);
  onClusterClickRef.current = onClusterClick;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onNeedMoreRef = useRef(onNeedMore);
  onNeedMoreRef.current = onNeedMore;
  const selectedPostIdRef = useRef(selectedPostId);
  selectedPostIdRef.current = selectedPostId;

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
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

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

    const solidMesh = createDepthMask();
    const surfaceMesh = createSurfaceMesh(0x071428);
    const { mesh: wireMesh, material: wireMat } = createWireframeMesh({
      color: 0x1a4aff,
      linewidth: 0.4,
      opacity: 0.26,
      resolution: new THREE.Vector2(W(), H()),
    });

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
    spinGroup.add(solidMesh, surfaceMesh, wireMesh, outlineGroup);

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
      clusterObjects: [],
    };

    function resize() {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      overlayCanvas.width = Math.round(W() * dpr);
      overlayCanvas.height = Math.round(H() * dpr);
      wireMat.resolution.set(W(), H());
      outlineMat.resolution.set(W(), H());
    }
    window.addEventListener("resize", resize);
    resize();

    const drag = dragRef.current;
    const AXIS_THRESHOLD = 5;

    function collapseAllFans() {
      const sc = sceneRef.current;
      if (sc) sc.clusterObjects.forEach((c) => { c.isExpanded = false; });
    }

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
      if (!drag.dragMoved) {
        // Canvas tap with no drag = collapse any open fan
        collapseAllFans();
      }
      drag.arTimer = setTimeout(() => {
        drag.autoRotate = true;
      }, 3500);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) return;
      drag.isDragging = true;
      drag.dragMoved = false;
      drag.dragAxis = null;
      drag.prevX = e.touches[0].clientX;
      drag.prevY = e.touches[0].clientY;
      if (drag.arTimer) clearTimeout(drag.arTimer);
      drag.autoRotate = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) return;
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
      if (!drag.dragMoved) {
        collapseAllFans();
      }
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
    const _cv1 = new THREE.Vector3();
    const _cv2 = new THREE.Vector3();
    const _cv3 = new THREE.Vector3();

    function toSphere(lat: number, lon: number, r: number, out: THREE.Vector3) {
      const latR = lat * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      out.set(
        -r * Math.cos(latR) * Math.cos(theta),
        r * Math.sin(latR),
        r * Math.cos(latR) * Math.sin(theta),
      );
    }

    // ── Globe labels ────────────────────────────────────────────────
    const labelObjects = GLOBE_LABELS.map(({ name, lat, lon, type, size }) => ({
      localPos: projectPoint(lat, lon, RADIUS),
      name, lat, lon, type, size,
      prog: 0,
      maxOpacity: type === "ocean" ? 0.52 : 0.42,
    }));

    function updateLabels() {
      _mat3.getNormalMatrix(spinGroup.matrixWorld);
      const dark = document.documentElement.classList.contains("dark");

      for (const lbl of labelObjects) {
        _wPos.copy(lbl.localPos).applyMatrix4(spinGroup.matrixWorld);
        _nrm.copy(lbl.localPos).normalize().applyMatrix3(_mat3).normalize();
        _toCam.copy(camera.position).sub(_wPos).normalize();
        const facing = _toCam.dot(_nrm);
        const target = Math.max(0, Math.min(1, (facing - 0.3) / 0.28));
        lbl.prog += (target - lbl.prog) * 0.04;
        if (lbl.prog < 0.01) continue;

        const opacity = lbl.prog * lbl.maxOpacity;
        const fontSize = lbl.size === "lg" ? 12 : lbl.size === "md" ? 9 : 7;
        const letterSpacing = fontSize * (lbl.type === "ocean" ? 0.24 : 0.16);
        ctx2d.font = `300 ${lbl.type === "ocean" ? "italic " : ""}${fontSize}px 'Cormorant Garamond', serif`;

        const chars = lbl.name.split("");
        const widths = chars.map((c) => ctx2d.measureText(c).width);
        const totalWidth =
          widths.reduce((s, w) => s + w, 0) +
          letterSpacing * Math.max(0, chars.length - 1);

        const delta = 3;
        toSphere(lbl.lat, lbl.lon - delta, RADIUS, _cv1);
        _cv1.applyMatrix4(spinGroup.matrixWorld);
        const l2D = toScreen(_cv1);
        toSphere(lbl.lat, lbl.lon + delta, RADIUS, _cv2);
        _cv2.applyMatrix4(spinGroup.matrixWorld);
        const r2D = toScreen(_cv2);
        const pxPerDeg =
          Math.sqrt((r2D.x - l2D.x) ** 2 + (r2D.y - l2D.y) ** 2) / (2 * delta);
        if (pxPerDeg < 1) continue;

        ctx2d.fillStyle = dark
          ? `rgba(255,255,255,${opacity.toFixed(3)})`
          : `rgba(20,20,14,${opacity.toFixed(3)})`;
        ctx2d.textBaseline = "middle";

        let xOff = -totalWidth / 2;
        for (let i = 0; i < chars.length; i++) {
          const w = widths[i];
          const charCenter = xOff + w / 2;
          const charLon = lbl.lon + charCenter / pxPerDeg;

          toSphere(lbl.lat, charLon, RADIUS, _cv1);
          _cv1.applyMatrix4(spinGroup.matrixWorld);
          const pos2D = toScreen(_cv1);

          const dd = 0.5;
          toSphere(lbl.lat, charLon - dd, RADIUS, _cv2);
          _cv2.applyMatrix4(spinGroup.matrixWorld);
          const tL = toScreen(_cv2);
          toSphere(lbl.lat, charLon + dd, RADIUS, _cv3);
          _cv3.applyMatrix4(spinGroup.matrixWorld);
          const tR = toScreen(_cv3);
          const charAngle = Math.atan2(tR.y - tL.y, tR.x - tL.x);

          ctx2d.save();
          ctx2d.translate(pos2D.x, pos2D.y);
          ctx2d.rotate(charAngle);
          ctx2d.fillText(chars[i], 0, 0);
          ctx2d.restore();

          xOff += w + letterSpacing;
        }
      }
    }
    // ────────────────────────────────────────────────────────────────

    const ROT_PER_SHIFT = 0.5;

    function drawOverlay() {
      const s = sceneRef.current;
      if (!s) return;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, W(), H());
      _mat3.getNormalMatrix(spinGroup.matrixWorld);

      const totalClusters = s.clusterObjects.length;
      if (totalClusters === 0) return;

      const currentRotY = spinGroup.rotation.y;
      const rotDelta = currentRotY - drag.lastRotY;
      drag.lastRotY = currentRotY;

      if (drag.isDragging || Math.abs(drag.rotVel) > 0.003) {
        rotAccumRef.current += rotDelta;
      }

      if (Math.abs(rotAccumRef.current) >= ROT_PER_SHIFT) {
        const shifts = Math.floor(Math.abs(rotAccumRef.current) / ROT_PER_SHIFT);
        if (rotAccumRef.current > 0) {
          windowCursorRef.current -= shifts;
        } else {
          windowCursorRef.current += shifts;
        }
        rotAccumRef.current = rotAccumRef.current % ROT_PER_SHIFT;
        windowCursorRef.current =
          ((windowCursorRef.current % totalClusters) + totalClusters) % totalClusters;

        if (windowCursorRef.current + WINDOW_SIZE >= totalClusters - 5) {
          onNeedMoreRef.current?.();
        }
      }

      const visibleIndices = new Set<number>();
      for (let i = 0; i < Math.min(WINDOW_SIZE, totalClusters); i++) {
        visibleIndices.add((windowCursorRef.current + i) % totalClusters);
      }

      const selId = selectedPostIdRef.current;

      // Mark hidden / visible — also keep clusters containing the selected post visible
      s.clusterObjects.forEach((p) => {
        const containsSelected = selId
          ? p.cluster.posts.some((post) => post.id === selId)
          : false;
        p.isHidden = !visibleIndices.has(p.dateIndex) && !containsSelected;
      });

      // Report ALL posts in visible front-facing clusters (for next/prev navigation)
      const visiblePosts = s.clusterObjects
        .filter((p) => !p.isHidden && p.facing > -0.1)
        .flatMap((p) => p.cluster.posts);
      onVisiblePostsChangeRef.current?.(visiblePosts);

      s.clusterObjects.forEach((p) => {
        // ── Early exit: fully hidden and faded ──
        if (p.isHidden && p.progress <= 0) {
          p.el.style.display = "none";
          p.originEl.style.display = "none";
          p.fanEls.forEach((f) => { f.style.display = "none"; });
          return;
        }

        // ── Facing / progress ──
        _wPos.copy(p.localPos).applyMatrix4(spinGroup.matrixWorld);
        _nrm.copy(p.localPos).normalize().applyMatrix3(_mat3).normalize();
        _toCam.copy(camera.position).sub(_wPos).normalize();
        const facing = _toCam.dot(_nrm);
        p.facing = facing;

        const targetVis = p.isHidden
          ? 0
          : Math.max(0, Math.min(1, (facing + 0.1) / 0.2));

        p.progress += (targetVis - p.progress) * EASE;
        if (p.progress < 0.003) p.progress = 0;
        if (p.progress > 0.997) p.progress = 1;

        const prog = p.progress;
        if (prog <= 0) {
          p.el.style.display = "none";
          p.originEl.style.display = "none";
          p.fanEls.forEach((f) => { f.style.display = "none"; });
          (p.dot.material as THREE.MeshBasicMaterial).opacity = 0;
          p.lagX = null;
          p.lagY = null;
          return;
        }

        const sp = toScreen(_wPos);
        const eased = easeInOut(prog);
        (p.dot.material as THREE.MeshBasicMaterial).opacity = Math.min(0.45, prog * 1.5);

        // ── Origin dot (pulsating pin on surface) ──
        const originAlpha = Math.max(0, Math.min(1, (facing + 0.05) / 0.25));
        if (originAlpha > 0.02) {
          p.originEl.style.display = "block";
          p.originEl.style.left = sp.x + "px";
          p.originEl.style.top = sp.y + "px";
          p.originEl.style.opacity = String(originAlpha);
        } else {
          p.originEl.style.display = "none";
        }

        // ── Outward normal direction in screen space ──
        const normalWorld = _nrm.clone();
        const tipWorld = _wPos.clone().add(normalWorld.clone().multiplyScalar(0.18));
        const spTip = toScreen(tipWorld);
        let ndx = spTip.x - sp.x;
        let ndy = spTip.y - sp.y;
        const nlen = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
        ndx /= nlen;
        ndy /= nlen;

        // ── Lag toward the stalk tip ──
        const targetX = sp.x + ndx * LINE_MAX;
        const targetY = sp.y + ndy * LINE_MAX;

        if (p.lagX === null) {
          p.lagX = sp.x;
          p.lagY = sp.y - 10;
        }
        p.lagX += (targetX - p.lagX) * LAG_SPEED;
        p.lagY! += (targetY - p.lagY!) * LAG_SPEED;

        const ddx = p.lagX - sp.x;
        const ddy = p.lagY! - sp.y;
        const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
        const maxDist = LINE_MAX * 1.6;
        let ex = p.lagX, ey = p.lagY!;
        if (ddist > maxDist) {
          ex = sp.x + (ddx / ddist) * maxDist;
          ey = sp.y + (ddy / ddist) * maxDist;
          p.lagX = ex;
          p.lagY = ey;
        }

        const midX = sp.x + (ex - sp.x) * eased;
        const midY = sp.y + (ey - sp.y) * eased;

        const [tr, tg, tb] = p.tagColorRgb;

        // ── Fan animation progress ──
        const targetFanProg = p.isExpanded ? 1 : 0;
        p.fanProgress += (targetFanProg - p.fanProgress) * 0.08;
        const fp = p.fanProgress;
        const fanEased = easeInOut(Math.min(1, fp));

        const clusterSize = p.cluster.size;

        // ═══════════════════════════════════════════════════════════════
        // SINGLE POST — original behaviour, unchanged
        // ═══════════════════════════════════════════════════════════════
        if (clusterSize === "single") {
          const isSelected = selId === p.cluster.posts[0].id;

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
            if (isSelected) {
              p.el.classList.add("post-dot-selected");
            } else {
              p.el.classList.remove("post-dot-selected");
            }
          } else {
            p.el.style.display = "none";
          }
          return;
        }

        // ═══════════════════════════════════════════════════════════════
        // MULTI-POST CLUSTER (small = fan / large = panel)
        // ═══════════════════════════════════════════════════════════════

        const dotFadeStart = 0.55;
        const dotAlpha =
          prog > dotFadeStart ? Math.min(1, (prog - dotFadeStart) / 0.25) : 0;

        // Badge stalk — fades out as fan opens
        if (eased > 0.01) {
          const stalkAlpha = eased * 0.55 * (1 - fanEased * 0.85);
          if (stalkAlpha > 0.01) {
            ctx2d.beginPath();
            ctx2d.moveTo(Math.round(sp.x), Math.round(sp.y));
            ctx2d.lineTo(Math.round(midX), Math.round(midY));
            ctx2d.strokeStyle = `rgba(${tr},${tg},${tb},${stalkAlpha})`;
            ctx2d.lineWidth = 1.3;
            ctx2d.stroke();
          }
        }

        // Badge el — fades when fan is open so items are visible
        if (dotAlpha > 0) {
          const badgeAlpha = dotAlpha * (1 - fanEased * 0.7);
          p.el.style.display = "block";
          p.el.style.left = midX + "px";
          p.el.style.top = midY + "px";
          p.el.style.opacity = String(badgeAlpha);
          p.el.style.pointerEvents = dotAlpha > 0.4 ? "all" : "none";
        } else {
          p.el.style.display = "none";
        }

        // ── Fan items (small clusters only) ──
        if (clusterSize === "small" && fp > 0.005) {
          const n = p.cluster.posts.length;
          const baseAngle = Math.atan2(ndy, ndx);

          for (let i = 0; i < n; i++) {
            const post = p.cluster.posts[i];
            const fanColor = getTagColor(post.tag, post.type);
            const [fr, fg, fb] = fanColor.rgb;

            const angleOffset = (i - (n - 1) / 2) * FAN_SPREAD;
            const fanAngle = baseAngle + angleOffset;
            const fdx = Math.cos(fanAngle);
            const fdy = Math.sin(fanAngle);

            // Fan item target position (expanded)
            const expandedX = sp.x + fdx * FAN_LENGTH;
            const expandedY = sp.y + fdy * FAN_LENGTH;

            // Interpolate from badge position to fan position
            const fanX = midX + (expandedX - midX) * fanEased;
            const fanY = midY + (expandedY - midY) * fanEased;

            // Draw fan stalk
            ctx2d.beginPath();
            ctx2d.moveTo(Math.round(sp.x), Math.round(sp.y));
            ctx2d.lineTo(Math.round(fanX), Math.round(fanY));
            ctx2d.strokeStyle = `rgba(${fr},${fg},${fb},${fp * 0.65 * eased})`;
            ctx2d.lineWidth = 1.3;
            ctx2d.stroke();

            const fanEl = p.fanEls[i];
            const isSelected = selId === post.id;
            fanEl.style.display = "block";
            fanEl.style.left = fanX + "px";
            fanEl.style.top = fanY + "px";
            fanEl.style.opacity = String(fp * Math.min(1, eased));
            fanEl.style.pointerEvents = fp > 0.5 ? "all" : "none";
            if (isSelected) {
              fanEl.classList.add("post-dot-selected");
            } else {
              fanEl.classList.remove("post-dot-selected");
            }
          }
        } else if (clusterSize === "small") {
          // Fully collapsed — hide all fan items
          p.fanEls.forEach((f) => {
            f.style.display = "none";
            f.style.pointerEvents = "none";
          });
        }
      });
    }

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);

      if (spinToLonRef.current !== null) {
        const targetRotY = getRotationForCenteredLongitude(spinToLonRef.current);
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
      updateLabels();
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

  // ── Build cluster objects whenever posts change ───────────────────
  useEffect(() => {
    const s = sceneRef.current;
    const dotsContainer = dotsRef.current;
    if (!s || !dotsContainer) return;

    // Tear down existing objects
    s.clusterObjects.forEach((p) => {
      p.el.style.display = "none";
      p.originEl.style.display = "none";
      p.fanEls.forEach((f) => { f.style.display = "none"; f.remove(); });
      s.spinGroup.remove(p.dot);
      p.el.remove();
      p.originEl.remove();
    });
    const overlayCanvas = overlayRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext("2d");
      ctx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    // Sort newest-first then cluster
    const sorted = [...posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const clusters = buildClusters(sorted, CLUSTER_THRESH_DEG);

    s.clusterObjects = clusters.map((cluster, dateIndex) => {
      const localPos = projectPoint(cluster.centroidLat, cluster.centroidLon, RADIUS);
      const primaryPost = cluster.posts[0];
      const tagColor = getTagColor(primaryPost.tag, primaryPost.type);

      const dotRadius = cluster.size === "single" ? 0.007 : 0.009;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(dotRadius, 8, 8),
        new THREE.MeshBasicMaterial({
          color: tagColor.hexNum,
          transparent: true,
          opacity: 0,
        }),
      );
      dot.position.copy(localPos);
      s.spinGroup.add(dot);

      // ── Main element ──
      const el = document.createElement("div");
      el.style.display = "none";
      el.style.opacity = "0";
      el.style.setProperty("--tag-color", tagColor.hex);

      if (cluster.size === "single") {
        // Identical to previous single-post rendering
        el.className = "post-dot type-" + primaryPost.type;
        const normalizedTag = normalizeTag(primaryPost.tag, primaryPost.type);
        const tagLabel = `[${normalizedTag}]`;
        if (primaryPost.type === "photo") {
          const snippet =
            (primaryPost.caption || "").split(" ").slice(0, 4).join(" ") + "…";
          el.innerHTML = `<div class="font-mono-ui" style="font-size:0.44rem;letter-spacing:0.12em;text-transform:uppercase;color:${tagColor.hex};text-align:center">${tagLabel}</div><div style="font-size:0.66rem;font-style:italic;color:hsl(var(--muted-foreground));white-space:nowrap;max-width:78px;overflow:hidden;text-overflow:ellipsis;text-align:center">${(primaryPost.caption || "").split(" ").slice(0, 4).join(" ")}…</div>`;
        } else if (primaryPost.type === "audio") {
          const bars = Array.from({ length: 7 }, () => {
            const dur = (0.35 + Math.random() * 0.5).toFixed(2);
            const del = (Math.random() * 0.4).toFixed(2);
            return `<div class="voice-bar" style="--dur:${dur}s;animation-delay:${del}s"></div>`;
          }).join("");
          el.innerHTML = `<div class="font-mono-ui" style="font-size:0.42rem;letter-spacing:0.1em;text-transform:uppercase;color:${tagColor.hex};line-height:1;text-align:center">${tagLabel}</div><div class="voice-bars">${bars}</div>`;
        }
      } else {
        // Cluster badge
        const ringClass = cluster.size === "large" ? "cluster-badge-ring cluster-large" : "cluster-badge-ring";
        el.className = "post-dot cluster-badge";
        el.innerHTML = `<div class="${ringClass}" style="border-color:${tagColor.hex};background:color-mix(in srgb,${tagColor.hex} 12%,transparent)"><span class="cluster-badge-count" style="color:${tagColor.hex}">${cluster.posts.length}</span></div>`;
      }

      // ── Click handler ──
      // (clusterObj declared below, assigned after — safe since click only fires after assignment)
      let clusterObj!: ClusterObject;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const sc = sceneRef.current;
        if (!sc) return;
        if (cluster.size === "single") {
          onPostClickRef.current(cluster.posts[0]);
        } else if (cluster.size === "small") {
          const wasExpanded = clusterObj.isExpanded;
          sc.clusterObjects.forEach((c) => { c.isExpanded = false; });
          if (!wasExpanded) clusterObj.isExpanded = true;
        } else {
          onClusterClickRef.current?.(cluster.posts);
        }
      });

      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        spinToLonRef.current = cluster.centroidLon;
      });

      dotsContainer.appendChild(el);

      // ── Pulsating origin dot ──
      const originEl = document.createElement("div");
      originEl.className = "globe-origin-dot";
      originEl.style.display = "none";
      originEl.style.setProperty("--tag-color", tagColor.hex);
      dotsContainer.appendChild(originEl);

      // ── Fan elements (small clusters only) ──
      const fanEls: HTMLDivElement[] = [];
      if (cluster.size === "small") {
        for (let i = 0; i < cluster.posts.length; i++) {
          const post = cluster.posts[i];
          const fanColor = getTagColor(post.tag, post.type);
          const fanEl = document.createElement("div");
          fanEl.className = "post-dot type-" + post.type;
          fanEl.style.display = "none";
          fanEl.style.opacity = "0";
          fanEl.style.setProperty("--tag-color", fanColor.hex);

          const fanNormalizedTag = normalizeTag(post.tag, post.type);
          const fanTagLabel = `[${fanNormalizedTag}]`;
          if (post.type === "photo") {
            fanEl.innerHTML = `<div class="font-mono-ui" style="font-size:0.44rem;letter-spacing:0.12em;text-transform:uppercase;color:${fanColor.hex};text-align:center">${fanTagLabel}</div><div style="font-size:0.66rem;font-style:italic;color:hsl(var(--muted-foreground));white-space:nowrap;max-width:78px;overflow:hidden;text-overflow:ellipsis;text-align:center">${(post.caption || "").split(" ").slice(0, 4).join(" ")}…</div>`;
          } else if (post.type === "audio") {
            const bars = Array.from({ length: 7 }, () => {
              const dur = (0.35 + Math.random() * 0.5).toFixed(2);
              const del = (Math.random() * 0.4).toFixed(2);
              return `<div class="voice-bar" style="--dur:${dur}s;animation-delay:${del}s"></div>`;
            }).join("");
            fanEl.innerHTML = `<div class="font-mono-ui" style="font-size:0.42rem;letter-spacing:0.1em;text-transform:uppercase;color:${fanColor.hex};line-height:1;text-align:center">${fanTagLabel}</div><div class="voice-bars">${bars}</div>`;
          }

          fanEl.addEventListener("click", (e) => {
            e.stopPropagation();
            clusterObj.isExpanded = false;
            onPostClickRef.current(post);
          });

          dotsContainer.appendChild(fanEl);
          fanEls.push(fanEl);
        }
      }

      clusterObj = {
        localPos,
        dot,
        el,
        originEl,
        cluster,
        progress: 0,
        lagX: null,
        lagY: null,
        facing: 0,
        dateIndex,
        tagColorRgb: tagColor.rgb,
        _drawnX: 0,
        _drawnY: 0,
        isHidden: true,
        isExpanded: false,
        fanProgress: 0,
        fanEls,
      };

      return clusterObj;
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
        className="fixed inset-0 w-full h-full pointer-events-none z-[5]"
      />
      <div ref={dotsRef} className="fixed inset-0 pointer-events-none z-[10]" />
    </>
  );
}
