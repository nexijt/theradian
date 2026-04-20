import React, { useEffect, useRef } from "react";

interface OrbitingMoonProps {
  onClick: () => void;
  label?: string;
}

/**
 * A small moon that subtly orbits in the bottom-right corner.
 * Tap to expand your moon into full view (navigates to /@username).
 */
export default function OrbitingMoon({ onClick, label }: OrbitingMoonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const radius = 16;
    const period = 9000;

    const tick = () => {
      const t = (performance.now() - start) / period;
      const a = t * Math.PI * 2;
      if (ref.current) {
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius * 0.45;
        ref.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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

        {/* Moon button — orbits around the ring center */}
        <button
          ref={ref}
          onClick={onClick}
          aria-label={label ? `${label} — open your moon` : "Open your moon"}
          title={label || "Your moon"}
          className="pointer-events-auto absolute group w-9 h-9 sm:w-10 sm:h-10 rounded-full cursor-pointer transition-transform hover:scale-115 active:scale-95"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, hsl(36 8% 80%), hsl(0 0% 42%) 72%, hsl(0 0% 22%) 100%)",
            boxShadow:
              "inset -3px -3px 7px rgba(0,0,0,0.5), 0 0 16px rgba(255,255,255,0.07), 0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {/* Crater marks */}
          <span className="absolute top-[22%] left-[26%] w-[20%] h-[20%] rounded-full bg-black/22" />
          <span className="absolute top-[54%] left-[54%] w-[13%] h-[13%] rounded-full bg-black/22" />
          <span className="absolute top-[38%] left-[62%] w-[9%] h-[9%] rounded-full bg-black/18" />
          <span className="absolute top-[65%] left-[30%] w-[7%] h-[7%] rounded-full bg-black/15" />
        </button>
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
