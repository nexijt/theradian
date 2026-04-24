import React, { useRef, useState, useEffect } from "react";

interface AudioPlayerProps {
  src: string;
}

export default function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setProgress(audio.currentTime);
    };
    const onMeta = () => {
      setDuration(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onError = () => {
      setLoadError(true);
      setPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Generate fake waveform bars
  const bars = 32;
  const barHeights = useRef(
    Array.from({ length: bars }, () => 0.2 + Math.random() * 0.8)
  ).current;

  if (loadError) {
    return (
      <div className="bg-secondary rounded-lg p-4 flex items-center gap-3 opacity-50">
        <div className="w-10 h-10 rounded-full border border-foreground/20 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-foreground">
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/><circle cx="12" cy="12" r="10"/>
          </svg>
        </div>
        <span className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-muted-foreground">Audio unavailable</span>
      </div>
    );
  }

  return (
    <div className="bg-secondary rounded-lg p-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Waveform visualization */}
      <div
        className="flex items-center gap-[1.5px] h-16 mb-3 cursor-pointer"
        onClick={seek}
      >
        {barHeights.map((h, i) => {
          const ratio = duration ? progress / duration : 0;
          const active = i / bars <= ratio;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-colors duration-150"
              style={{
                height: `${h * 100}%`,
                background: active ? "hsl(228,100%,55%)" : "hsl(228,100%,55%,0.2)",
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg transition-colors hover:bg-primary-light"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div className="font-mono text-[0.56rem] tracking-[0.1em] text-muted-foreground">
          {formatTime(progress)} / {formatTime(duration || 0)}
        </div>
      </div>
    </div>
  );
}
