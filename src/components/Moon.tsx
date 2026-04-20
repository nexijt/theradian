import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { FeedPost } from "@/hooks/useFeed";
import { getTagColor, normalizeTag } from "@/lib/tag-colors";

const RADIUS = 1.0;

function projectPoint(lat: number, lon: number, r: number): THREE.Vector3 {
  const latR = lat * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.cos(latR) * Math.cos(theta),
    r * Math.sin(latR),
    r * Math.cos(latR) * Math.sin(theta)
  );
}

interface MoonProps {
  posts: FeedPost[];
  onPostClick?: (post: FeedPost) => void;
}

/**
 * A 3D grey/silver moon that displays the user's posts as glowing dots on its surface.
 * Smaller, intimate counterpart to the world Globe.
 */
export default function Moon({ posts, onPostClick }: MoonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const onPostClickRef = useRef(onPostClick);
  onPostClickRef.current = onPostClick;
  const postsRef = useRef(posts);
  postsRef.current = posts;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const overlayEl = overlayRef.current!;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 3.6);
    camera.lookAt(0, 0, 0);

    // Lighting for the moon
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(2, 1.2, 2.5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xb8c4d8, 0.25);
    rim.position.set(-2, -1, -1);
    scene.add(rim);

    // Moon surface — soft grey with subtle bump
    const moonGeo = new THREE.SphereGeometry(RADIUS, 96, 64);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0x8c8c8c,
      roughness: 0.92,
      metalness: 0.05,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    scene.add(moon);

    // Faint craters via small darker dots on surface (purely decorative)
    const craterGroup = new THREE.Group();
    const craterMat = new THREE.MeshBasicMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.35 });
    const craterCount = 24;
    for (let i = 0; i < craterCount; i++) {
      const lat = (Math.random() - 0.5) * 160;
      const lon = (Math.random() - 0.5) * 360;
      const pos = projectPoint(lat, lon, RADIUS * 1.001);
      const size = 0.02 + Math.random() * 0.05;
      const c = new THREE.Mesh(new THREE.CircleGeometry(size, 16), craterMat);
      c.position.copy(pos);
      c.lookAt(pos.clone().multiplyScalar(2));
      craterGroup.add(c);
    }
    moon.add(craterGroup);

    // Posts as small glowing dots (HTML overlays) on the moon
    const postEls: { el: HTMLDivElement; localPos: THREE.Vector3; data: FeedPost }[] = [];
    postsRef.current.forEach((p) => {
      const el = document.createElement("div");
      el.className = "moon-post-dot";
      const color = getTagColor(p.tag, p.type);
      el.style.setProperty("--tag-color", color.hex);
      el.title = `[${normalizeTag(p.tag, p.type)}] ${p.location}`;
      el.addEventListener("click", () => onPostClickRef.current?.(p));
      overlayEl.appendChild(el);
      postEls.push({ el, localPos: projectPoint(p.lat, p.lon, RADIUS * 1.005), data: p });
    });

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Drag to rotate
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let rotVelY = 0;
    let autoRotate = true;
    let arTimer: ReturnType<typeof setTimeout> | null = null;
    const onDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX; prevY = e.clientY;
      autoRotate = false;
      if (arTimer) clearTimeout(arTimer);
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      moon.rotation.y += dx * 0.008;
      moon.rotation.x = Math.max(-0.6, Math.min(0.6, moon.rotation.x + dy * 0.005));
      rotVelY = dx * 0.008;
      prevX = e.clientX; prevY = e.clientY;
    };
    const onUp = () => {
      isDragging = false;
      arTimer = setTimeout(() => { autoRotate = true; }, 3000);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);

    const _world = new THREE.Vector3();
    const _toCam = new THREE.Vector3();
    const _nrm = new THREE.Vector3();
    const _mat3 = new THREE.Matrix3();

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        moon.rotation.y += 0.0015;
      } else if (!isDragging) {
        moon.rotation.y += rotVelY;
        rotVelY *= 0.94;
      }

      _mat3.getNormalMatrix(moon.matrixWorld);
      const rect = canvas.getBoundingClientRect();

      postEls.forEach(({ el, localPos }) => {
        _world.copy(localPos).applyMatrix4(moon.matrixWorld);
        _nrm.copy(localPos).normalize().applyMatrix3(_mat3).normalize();
        _toCam.copy(camera.position).sub(_world).normalize();
        const facing = _toCam.dot(_nrm);

        const proj = _world.clone().project(camera);
        const x = (proj.x * 0.5 + 0.5) * rect.width;
        const y = (-proj.y * 0.5 + 0.5) * rect.height;

        if (facing > -0.05) {
          const alpha = Math.max(0, Math.min(1, (facing + 0.05) / 0.3));
          el.style.display = "block";
          el.style.left = x + "px";
          el.style.top = y + "px";
          el.style.opacity = String(alpha);
        } else {
          el.style.display = "none";
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      postEls.forEach(({ el }) => el.remove());
      moonGeo.dispose();
      moonMat.dispose();
      renderer.dispose();
    };
  }, [posts]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto" />
    </div>
  );
}