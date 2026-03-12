import React from "react";
import type { FeedPost } from "@/hooks/useFeed";
import AudioPlayer from "./AudioPlayer";

interface PostPanelProps {
  post: FeedPost | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function PostPanel({ post, onClose, onNext, onPrev }: PostPanelProps) {
  if (!post) return null;

  const isOpen = !!post;
  const locationText = post.location && post.location !== "Unknown" ? post.location : "Somewhere on Earth";

  return (
    <div
      className="fixed top-1/2 right-8 z-[60] w-[290px] rounded-sm p-7"
      style={{
        transform: isOpen ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(calc(100% + 48px))",
        transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1)",
        background: "hsla(36,24%,94%,0.97)",
        border: "1px solid hsl(0 0% 10% / 0.09)",
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3.5 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground text-base"
      >
        ✕
      </button>

      <div className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-primary mb-2.5">
        {post.tag ? `[${post.tag}] ` : ""}{locationText}
      </div>
      <div className="text-lg font-light italic mb-1">
        @{post.user}
      </div>
      <div className="font-mono text-[0.56rem] text-muted-foreground tracking-[0.1em] mb-4">
        {post.time}
      </div>

      {post.type === "photo" && (
        <div className="relative mb-3.5 flex items-center">
          {/* Prev arrow - outside left */}
          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute -left-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
            >
              <span className="text-base font-light select-none">‹</span>
            </button>
          )}
          <div className="w-full aspect-square rounded-sm overflow-hidden bg-secondary flex items-center justify-center">
            {post.mediaUrl ? (
              <img src={post.mediaUrl} alt={post.caption} className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-[0.6rem] text-muted-foreground tracking-[0.1em]">[ Photo ]</span>
            )}
          </div>
          {/* Next arrow - outside right */}
          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute -right-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
            >
              <span className="text-base font-light select-none">›</span>
            </button>
          )}
        </div>
      )}

      {post.type === "audio" && (
        <div className="relative mb-3.5 flex items-center">
          {/* Prev arrow - outside left */}
          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute -left-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
            >
              <span className="text-base font-light select-none">‹</span>
            </button>
          )}
          <div className="w-full">
            {post.mediaUrl ? (
              <AudioPlayer src={post.mediaUrl} />
            ) : (
              <div className="w-full aspect-square rounded-full bg-secondary flex items-center justify-center">
                <span className="font-mono text-[0.6rem] text-muted-foreground tracking-[0.1em]">[ Audio ]</span>
              </div>
            )}
          </div>
          {/* Next arrow - outside right */}
          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute -right-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
            >
              <span className="text-base font-light select-none">›</span>
            </button>
          )}
        </div>
      )}

      <div className="text-[0.93rem] leading-relaxed" style={{ color: "#444" }}>
        {post.caption}
      </div>
    </div>
  );
}