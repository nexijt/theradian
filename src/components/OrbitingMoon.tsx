import React, { useEffect, useRef } from "react";

interface OrbitingMoonProps {
  onClick: () => void;
  label?: string;
}

/**
 * A small moon icon that subtly orbits in a corner of the screen.
 * Click it to enter the user's profile (their personal moon view).
 */
export default function OrbitingMoon({ onClick, label }: OrbitingMoonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const radius = 14;
    const period = 9000;

    const tick = () => {
      const t = (performance.now() - start) / period;
      const a = t * Math.PI * 2;
      if (ref.current) {
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius * 0.5;
        ref.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed bottom-20 right-6 sm:bottom-24 sm:right-10 z-40">
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center pointer-events-none">
        <div
          className="absolute inset-0 rounded-full border border-foreground/10"
          style={{ transform: "scaleY(0.5)" }}
          aria-hidden
        />
        <button
          ref={ref}
          onClick={onClick}
          aria-label={label || "Open your moon"}
          title={label || "Your moon"}
          className="pointer-events-auto group relative w-9 h-9 sm:w-10 sm:h-10 rounded-full cursor-pointer transition-transform hover:scale-110"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, hsl(36 8% 78%), hsl(0 0% 38%) 75%, hsl(0 0% 24%) 100%)",
            boxShadow: "inset -3px -3px 6px rgba(0,0,0,0.45), 0 0 12px rgba(255,255,255,0.08)",
          }}
        >
          <span className="absolute top-[22%] left-[28%] w-[18%] h-[18%] rounded-full bg-black/25" />
          <span className="absolute top-[55%] left-[55%] w-[12%] h-[12%] rounded-full bg-black/25" />
          <span className="absolute top-[40%] left-[60%] w-[8%] h-[8%] rounded-full bg-black/20" />
        </button>
      </div>
      {label && (
        <div className="font-mono text-[0.5rem] tracking-[0.18em] uppercase text-muted-foreground whitespace-nowrap text-right pointer-events-none -mt-1">
          {label}
        </div>
      )}
    </div>
  );
}