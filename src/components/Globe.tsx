import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { CONTINENT_OUTLINES } from "@/lib/globe-data";
import type { FeedPost } from "@/hooks/useFeed";

const RADIUS = 1.0;
const LINE_MAX = 80;
const EASE = 0.065;
const LAG_SPEED = 0.045;
const OVERLAP_THRESH = 55;

function projectPoint(lat: number, lon: number, r: number): THREE.Vector3 {
  const latR = lat * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.cos(latR) * Math.cos(theta),
    r * Math.sin(latR),
    r * Math.cos(latR) * Math.sin(theta)
  );
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

interface PostObject {
  localPos: THREE.Vector3;
  dot: THREE.Mesh;
  el: HTMLDivElement;
  data: FeedPost;
  progress: number;
  lagX: number | null;
  lagY: number | null;
  _drawnX: number;
  _drawnY: number;
  lineLengthMult: number;
}

interface GlobeProps {
  posts: FeedPost[];
  onPostClick: (post: FeedPost) => void;
  onSpinComplete?: () => void;
}

export default function Globe({ posts, onPostClick, onSpinComplete }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    spinGroup: THREE.Group;
    postObjects: PostObject[];
  } | null>(null);
  const dragRef = useRef({
    isDragging: false,
    dragMoved: false,
    rotVel: 0,
    autoRotate: true,
    arTimer: null as ReturnType<typeof setTimeout> | null,
    prevX: 0,
    lastSpinY: 0,
  });

  const postsRef = useRef(posts);
  postsRef.current = posts;
  const onPostClickRef = useRef(onPostClick);
  onPostClickRef.current = onPostClick;
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  const W = useCallback(() => window.innerWidth, []);
  const H = useCallback(() => window.innerHeight, []);

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current!;
    const overlayCanvas = overlayRef.current!;
    const ctx2d = overlayCanvas.getContext("2d")!;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf4f1eb, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 1000);
    camera.position.set(0, 0, 3.8);
    camera.lookAt(0, 0, 0);

    // Solid blocker
    const solidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 0.997, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0xf4f1eb, depthWrite: true })
    );

    // Grid
    const wireMesh = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(RADIUS * 1.001, 36, 24)),
      new THREE.LineBasicMaterial({ color: 0x1a4aff, transparent: true, opacity: 0.15 })
    );

    // Outlines
    const outlineMat = new THREE.LineBasicMaterial({ color: 0x1a4aff, transparent: true, opacity: 0.72 });
    const outlineGroup = new THREE.Group();
    CONTINENT_OUTLINES.forEach((coords) => {
      const pts = coords.map(([lo, la]) => projectPoint(la, lo, RADIUS * 1.003));
      pts.push(pts[0].clone());
      outlineGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), outlineMat));
    });

    const spinGroup = new THREE.Group();
    spinGroup.add(solidMesh, wireMesh, outlineGroup);

    const tiltGroup = new THREE.Group();
    tiltGroup.add(spinGroup);
    tiltGroup.scale.setScalar(0.9);
    scene.add(tiltGroup);

    sceneRef.current = { renderer, scene, camera, spinGroup, postObjects: [] };

    // Resize
    function resize() {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      overlayCanvas.width = W();
      overlayCanvas.height = H();
    }
    window.addEventListener("resize", resize);
    resize();

    // Drag handlers
    const drag = dragRef.current;

    function onMouseDown(e: MouseEvent) {
      drag.isDragging = true;
      drag.dragMoved = false;
      drag.prevX = e.clientX;
      if (drag.arTimer) clearTimeout(drag.arTimer);
      drag.autoRotate = false;
    }
    function onMouseMove(e: MouseEvent) {
      if (!drag.isDragging) return;
      const dx = e.clientX - drag.prevX;
      if (Math.abs(dx) > 2) drag.dragMoved = true;
      drag.rotVel = dx * 0.005;
      spinGroup.rotation.y += drag.rotVel;
      drag.prevX = e.clientX;
    }
    function onMouseUp() {
      if (!drag.isDragging) return;
      drag.isDragging = false;
      drag.arTimer = setTimeout(() => { drag.autoRotate = true; }, 3500);

      // Check if a full spin segment happened
      const delta = Math.abs(spinGroup.rotation.y - drag.lastSpinY);
      if (delta > Math.PI / 2) {
        drag.lastSpinY = spinGroup.rotation.y;
        onSpinCompleteRef.current?.();
      }
    }
    function onTouchStart(e: TouchEvent) {
      drag.isDragging = true;
      drag.dragMoved = false;
      drag.prevX = e.touches[0].clientX;
      if (drag.arTimer) clearTimeout(drag.arTimer);
      drag.autoRotate = false;
    }
    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - drag.prevX;
      if (Math.abs(dx) > 2) drag.dragMoved = true;
      drag.rotVel = dx * 0.005;
      spinGroup.rotation.y += drag.rotVel;
      drag.prevX = e.touches[0].clientX;
    }
    function onTouchEnd() {
      drag.isDragging = false;
      drag.arTimer = setTimeout(() => { drag.autoRotate = true; }, 3500);
      const delta = Math.abs(spinGroup.rotation.y - drag.lastSpinY);
      if (delta > Math.PI / 2) {
        drag.lastSpinY = spinGroup.rotation.y;
        onSpinCompleteRef.current?.();
      }
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    // toScreen helper
    const _prj = new THREE.Vector3();
    function toScreen(worldV3: THREE.Vector3) {
      _prj.copy(worldV3).project(camera);
      return {
        x: (_prj.x * 0.5 + 0.5) * W(),
        y: (-_prj.y * 0.5 + 0.5) * H(),
      };
    }

    // Overlay draw
    const _wPos = new THREE.Vector3();
    const _nrm = new THREE.Vector3();
    const _mat3 = new THREE.Matrix3();

    function drawOverlay() {
      const s = sceneRef.current;
      if (!s) return;
      ctx2d.clearRect(0, 0, W(), H());
      _mat3.getNormalMatrix(spinGroup.matrixWorld);

      s.postObjects.forEach((p) => {
        _wPos.copy(p.localPos).applyMatrix4(spinGroup.matrixWorld);
        _nrm.copy(p.localPos).normalize().applyMatrix3(_mat3).normalize();

        const toCam = camera.position.clone().sub(_wPos).normalize();
        const facing = toCam.dot(_nrm);
        const targetVis = Math.max(0, Math.min(1, (facing + 0.03) / 0.20));

        p.progress += (targetVis - p.progress) * EASE;
        if (p.progress < 0.003) p.progress = 0;
        if (p.progress > 0.997) p.progress = 1;

        const prog = p.progress;
        if (prog <= 0) {
          p.el.style.display = "none";
          (p.dot.material as THREE.MeshBasicMaterial).opacity = 0;
          p.lagX = null;
          p.lagY = null;
          return;
        }

        const sp = toScreen(_wPos);
        const eased = easeInOut(prog);
        (p.dot.material as THREE.MeshBasicMaterial).opacity = p.data.type === "dot" ? 0 : Math.min(0.45, prog * 1.5);

        // Normal projection for line direction
        const normalWorld = _nrm.clone();
        const tipWorld = _wPos.clone().add(normalWorld.clone().multiplyScalar(0.18));
        const spTip = toScreen(tipWorld);
        let ndx = spTip.x - sp.x;
        let ndy = spTip.y - sp.y;
        const nlen = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
        ndx /= nlen;
        ndy /= nlen;

        const targetX = sp.x + ndx * LINE_MAX * p.lineLengthMult;
        const targetY = sp.y + ndy * LINE_MAX * p.lineLengthMult;

        if (p.lagX === null) { p.lagX = sp.x; p.lagY = sp.y - 10; }
        p.lagX += (targetX - p.lagX) * LAG_SPEED;
        p.lagY! += (targetY - p.lagY!) * LAG_SPEED;

        const dx = p.lagX - sp.x;
        const dy = p.lagY! - sp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = LINE_MAX * 1.6;
        let ex = p.lagX, ey = p.lagY!;
        if (dist > maxDist) {
          ex = sp.x + (dx / dist) * maxDist;
          ey = sp.y + (dy / dist) * maxDist;
          p.lagX = ex;
          p.lagY = ey;
        }

        const midX = sp.x + (ex - sp.x) * eased;
        const midY = sp.y + (ey - sp.y) * eased;

        if (eased > 0.01) {
          ctx2d.beginPath();
          ctx2d.moveTo(Math.round(sp.x), Math.round(sp.y));
          ctx2d.lineTo(Math.round(midX), Math.round(midY));
          ctx2d.strokeStyle = `rgba(26,74,255,${0.5 * eased})`;
          ctx2d.lineWidth = 0.9;
          ctx2d.stroke();
        }

        const dotFadeStart = 0.55;
        if (prog > dotFadeStart) {
          const dotAlpha = Math.min(1, (prog - dotFadeStart) / 0.25);
          if (p.data.type === "dot") {
            p._drawnX = midX;
            p._drawnY = midY;
            ctx2d.beginPath();
            ctx2d.arc(midX, midY, 4, 0, Math.PI * 2);
            ctx2d.fillStyle = `rgba(26,74,255,${dotAlpha})`;
            ctx2d.fill();
            ctx2d.beginPath();
            ctx2d.arc(midX, midY, 7, 0, Math.PI * 2);
            ctx2d.strokeStyle = `rgba(26,74,255,${dotAlpha * 0.22})`;
            ctx2d.lineWidth = 1.5;
            ctx2d.stroke();
            p.el.style.display = "none";
          } else {
            p.el.style.display = "block";
            p.el.style.left = midX + "px";
            p.el.style.top = midY + "px";
            p.el.style.opacity = String(dotAlpha);
            p.el.style.pointerEvents = dotAlpha > 0.4 ? "all" : "none";
          }
        } else {
          p.el.style.display = "none";
        }
      });

      // Overlap avoidance
      for (let i = 0; i < s.postObjects.length; i++) {
        const a = s.postObjects[i];
        if (a.progress <= 0 || a.lagX === null) continue;
        for (let j = i + 1; j < s.postObjects.length; j++) {
          const b = s.postObjects[j];
          if (b.progress <= 0 || b.lagX === null) continue;
          const ddx = a.lagX - b.lagX;
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

    // Animation loop
    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      if (drag.autoRotate && !drag.isDragging) {
        spinGroup.rotation.y -= 0.0009;
      } else if (!drag.isDragging) {
        drag.rotVel *= 0.92;
        spinGroup.rotation.y += drag.rotVel;
      }
      renderer.render(scene, camera);
      drawOverlay();
    }
    animate();

    // Click handler for dot-type posts on overlay canvas
    overlayCanvas.addEventListener("click", (e) => {
      const s = sceneRef.current;
      if (!s) return;
      const rect = overlayCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hit: PostObject | null = null;
      let bestDist = 16;
      s.postObjects.forEach((p) => {
        if (p.data.type !== "dot" || p.progress <= 0.55) return;
        const dist = Math.sqrt((mx - p._drawnX) ** 2 + (my - p._drawnY) ** 2);
        if (dist < bestDist) { bestDist = dist; hit = p; }
      });
      if (hit) {
        onPostClickRef.current((hit as PostObject).data);
      }
    });

    return () => {
      cancelAnimationFrame(animId);
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

    // Remove old post objects
    s.postObjects.forEach((p) => {
      s.spinGroup.remove(p.dot);
      p.el.remove();
    });

    // Create new post objects
    s.postObjects = posts.map((post) => {
      const localPos = projectPoint(post.lat, post.lon, RADIUS);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.007, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x1a4aff, transparent: true, opacity: 0 })
      );
      dot.position.copy(localPos);
      s.spinGroup.add(dot);

      const el = document.createElement("div");
      el.className = "post-dot type-" + post.type;
      el.style.display = "none";
      el.style.opacity = "0";

      if (post.type === "photo") {
        const snippet = post.caption.split(" ").slice(0, 4).join(" ") + "…";
        el.innerHTML = `<div class="font-mono-ui" style="font-size:0.44rem;letter-spacing:0.12em;text-transform:uppercase;color:hsl(228,100%,55%);text-align:center">[ photo ]</div><div style="font-size:0.66rem;font-style:italic;color:#666;white-space:nowrap;max-width:78px;overflow:hidden;text-overflow:ellipsis;text-align:center">${snippet}</div>`;
      } else if (post.type === "audio") {
        const bars = Array.from({ length: 7 }, () => {
          const dur = (0.35 + Math.random() * 0.5).toFixed(2);
          const del = (Math.random() * 0.4).toFixed(2);
          return `<div class="voice-bar" style="--dur:${dur}s;animation-delay:${del}s"></div>`;
        }).join("");
        el.innerHTML = `<div class="font-mono-ui" style="font-size:0.42rem;letter-spacing:0.1em;text-transform:uppercase;color:hsl(228,100%,55%);line-height:1;text-align:center">${post.category || "[AUDIO]"}</div><div class="voice-bars">${bars}</div>`;
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onPostClickRef.current(post);
      });

      dotsContainer.appendChild(el);

      return {
        localPos,
        dot,
        el,
        data: post,
        progress: 0,
        lagX: null,
        lagY: null,
        _drawnX: 0,
        _drawnY: 0,
        lineLengthMult: 1.0,
      };
    });
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
