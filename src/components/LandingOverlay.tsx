import React from "react";

interface LandingOverlayProps {
  open: boolean;
  onEnter: () => void;
}

const STEPS = [
  { glyph: "◦", label: "One photo or one sound, once a day" },
  { glyph: "◯", label: "Pinned to where you made it" },
  { glyph: "◉", label: "A globe of small daily marks" },
];

export default function LandingOverlay({ open, onEnter }: LandingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-6"
      style={{
        background: "hsl(var(--background) / 0.94)",
        backdropFilter: "blur(8px)",
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <div className="max-w-[520px] w-full text-center">
        <div className="font-mono text-[0.55rem] tracking-[0.28em] uppercase text-muted-foreground mb-3">
          The Radian · ver. 0.1
        </div>
        <h1 className="text-5xl sm:text-6xl font-light italic mb-4 text-foreground leading-[1.05]">
          A daily<br />creative log.
        </h1>
        <p className="font-serif text-base text-muted-foreground mb-12 leading-relaxed">
          Not a feed. A globe.<br />
          Each post is a single mark from somewhere on Earth.
        </p>

        <div className="space-y-5 mb-12 text-left max-w-[340px] mx-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <span
                className="text-xl text-primary w-6 text-center"
                style={{ fontFamily: "Cormorant Garamond, serif" }}
              >
                {s.glyph}
              </span>
              <span className="font-mono text-[0.62rem] tracking-[0.14em] uppercase text-foreground">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onEnter}
          className="font-mono text-[0.7rem] tracking-[0.28em] uppercase px-10 py-3.5 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light"
        >
          Enter
        </button>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}