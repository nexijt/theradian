import { useEffect, useRef } from "react";
import { CONTINENT_OUTLINES } from "@/lib/globe-data";

interface GlobeTimelineProps {
  rotationRef: React.MutableRefObject<number>;
  rotateDeltaRef: React.MutableRefObject<number>;
}

const HEIGHT = 38; // timeline strip height in px

// Must match Globe.tsx's drag sensitivity so the map scrolls 1:1 with your finger
const GLOBE_DRAG_SENSITIVITY = 0.008;

// Latitude band to display — clip poles (little landmass there) for better proportions
const LAT_MAX = 75;

// Natural equirectangular tile width: width/height = 360° / (LAT_MAX×2), no horizontal stretch
const TILE_WIDTH = Math.round(HEIGHT * (360 / (LAT_MAX * 2))); // = 108px

// Build the offscreen map tile at full physical resolution (dpr-aware, no blur)
function buildMapTile(darkMode: boolean, dpr: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(TILE_WIDTH * dpr);
  c.height = Math.round(HEIGHT * dpr);
  const ctx = c.getContext("2d")!;

  // Work in logical pixel space so coordinate math is simple
  ctx.scale(dpr, dpr);

  ctx.fillStyle = darkMode ? "#0a0a0a" : "#f5f0e8";
  ctx.fillRect(0, 0, TILE_WIDTH, HEIGHT);

  ctx.fillStyle = darkMode ? "#1d4ed8" : "#3b82f6";
  ctx.strokeStyle = darkMode ? "#1e40af" : "#2563eb";
  ctx.lineWidth = 0.3;

  for (const ring of CONTINENT_OUTLINES) {
    if (ring.length < 2) continue;
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const x = ((lon + 180) / 360) * TILE_WIDTH;
      // Map lat from [LAT_MAX, -LAT_MAX] → [0, HEIGHT], clipping poles
      const y = ((LAT_MAX - lat) / (LAT_MAX * 2)) * HEIGHT;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  return c;
}

export default function GlobeTimeline({
  rotationRef,
  rotateDeltaRef,
}: GlobeTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapTileRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef(Math.min(window.devicePixelRatio || 1, 2));
  const isDraggingRef = useRef(false);
  const prevXRef = useRef(0);
  const animIdRef = useRef(0);

  // Build/rebuild map tile — on mount and theme change (tileWidth is constant so no resize rebuild)
  useEffect(() => {
    function rebuild() {
      dprRef.current = Math.min(window.devicePixelRatio || 1, 2);
      const dark = document.documentElement.classList.contains("dark");
      mapTileRef.current = buildMapTile(dark, dprRef.current);
    }

    rebuild();

    const themeObserver = new MutationObserver(rebuild);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => themeObserver.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = dprRef.current;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = HEIGHT * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d")!;

    function draw() {
      animIdRef.current = requestAnimationFrame(draw);
      const tile = mapTileRef.current;
      if (!tile) return;

      const dpr = dprRef.current;
      const W = canvas.offsetWidth;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, HEIGHT);

      // Globe rotates right → map scrolls right; PHASE_OFFSET fine-tunes alignment
      const PHASE_OFFSET = 0.39 * TILE_WIDTH;
      const scrollOffset =
        (rotationRef.current / (2 * Math.PI)) * TILE_WIDTH + PHASE_OFFSET;
      const wrapped = ((scrollOffset % TILE_WIDTH) + TILE_WIDTH) % TILE_WIDTH;
      const startX = wrapped - TILE_WIDTH;

      const tilesNeeded = Math.ceil(W / TILE_WIDTH) + 2;

      for (let i = 0; i < tilesNeeded; i++) {
        ctx.drawImage(tile, startX + i * TILE_WIDTH, 0, TILE_WIDTH, HEIGHT);
      }

      // Vignette — heavy fade at edges to give the panel a contained look
      const vignette = ctx.createLinearGradient(0, 0, W, 0);
      const dark = document.documentElement.classList.contains("dark");
      const bg = dark ? "rgba(10,10,10," : "rgba(245,240,232,";
      vignette.addColorStop(0, bg + "1)");
      vignette.addColorStop(0.18, bg + "0.2)");
      vignette.addColorStop(0.3, bg + "0)");
      vignette.addColorStop(0.7, bg + "0)");
      vignette.addColorStop(0.82, bg + "0.2)");
      vignette.addColorStop(1, bg + "1)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, HEIGHT);

      // Batch boundary markers
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      for (let i = 0; i < tilesNeeded; i++) {
        const bx = Math.round(startX + i * TILE_WIDTH);
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, HEIGHT);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Center playhead
      const cx = W / 2;
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, HEIGHT);
      ctx.stroke();
    }

    draw();
    return () => {
      cancelAnimationFrame(animIdRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [rotationRef]);

  // Drag handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Same sensitivity as dragging the globe directly (Globe uses dx * 0.008 rad/px)
    // Positive dx (drag right) → positive rotation → globe spins right, map scrolls left
    const pxToRad = (px: number) => px * GLOBE_DRAG_SENSITIVITY;

    function onMouseDown(e: MouseEvent) {
      isDraggingRef.current = true;
      prevXRef.current = e.clientX;
      e.preventDefault();
    }
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevXRef.current;
      prevXRef.current = e.clientX;
      rotateDeltaRef.current += pxToRad(dx);
    }
    function onMouseUp() {
      isDraggingRef.current = false;
    }

    function onTouchStart(e: TouchEvent) {
      isDraggingRef.current = true;
      prevXRef.current = e.touches[0].clientX;
    }
    function onTouchMove(e: TouchEvent) {
      if (!isDraggingRef.current) return;
      const dx = e.touches[0].clientX - prevXRef.current;
      prevXRef.current = e.touches[0].clientX;
      rotateDeltaRef.current += pxToRad(dx);
      e.preventDefault();
    }
    function onTouchEnd() {
      isDraggingRef.current = false;
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [rotateDeltaRef]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "40%",
        right: "40%",
        height: HEIGHT,
        zIndex: 20,
        borderTop: "1px solid rgba(128,128,128,0.2)",
        borderLeft: "1px solid rgba(128,128,128,0.12)",
        borderRight: "1px solid rgba(128,128,128,0.12)",
        borderRadius: "6px 6px 0 0",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: HEIGHT,
          display: "block",
          cursor: "ew-resize",
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}
