import React from "react";
import type { FeedPost } from "@/hooks/useFeed";
import AudioPlayer from "./AudioPlayer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const TAG_DESCRIPTIONS: Record<string, string> = {
  PHOTO: "photography. analogue or digital",
  DESIGN: "digital edit.",
  MATTER: "physical. analogue. crafted.",
  MUSIC: "music you made.",
  VOICE: "singing. va.",
  SFX: "you. nature. digital.",
};

// WRITING has different descriptions depending on post type
function getTagDescription(tag: string, postType: "photo" | "audio"): string {
  if (tag === "WRITING") {
    return postType === "audio" ? "written by you." : "written by you.";
  }
  return TAG_DESCRIPTIONS[tag] || tag;
}

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
        {post.tag ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help border-b border-dotted border-primary/40">[{post.tag}]</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-mono text-[0.55rem] tracking-[0.08em] uppercase">
                {getTagDescription(post.tag, post.type)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {post.tag ? ` ${locationText}` : locationText}
      </div>
      <div className="text-lg font-light italic mb-1">
        @{post.user}
      </div>
      <div className="font-mono text-[0.56rem] text-muted-foreground tracking-[0.1em] mb-4">
        {post.time}
      </div>

      {post.type === "photo" && (
        <div className="w-full aspect-square rounded-sm mb-3.5 overflow-hidden bg-secondary flex items-center justify-center relative">
          {post.mediaUrl ? (
            <img src={post.mediaUrl} alt={post.caption} className="w-full h-full object-cover" />
          ) : (
            <span className="font-mono text-[0.6rem] text-muted-foreground tracking-[0.1em]">[ Photo ]</span>
          )}
          {/* Navigation arrows */}
          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-start pl-1.5 bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: "linear-gradient(to right, hsla(0,0%,0%,0.25), transparent)" }}
            >
              <span className="text-white text-lg font-light select-none">‹</span>
            </button>
          )}
          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pr-1.5 bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: "linear-gradient(to left, hsla(0,0%,0%,0.25), transparent)" }}
            >
              <span className="text-white text-lg font-light select-none">›</span>
            </button>
          )}
        </div>
      )}

      {post.type === "audio" && (
        <div className="mb-3.5 relative">
          {post.mediaUrl ? (
            <AudioPlayer src={post.mediaUrl} />
          ) : (
            <div className="w-full aspect-square rounded-full bg-secondary flex items-center justify-center">
              <span className="font-mono text-[0.6rem] text-muted-foreground tracking-[0.1em]">[ Audio ]</span>
            </div>
          )}
          {/* Navigation arrows for audio */}
          <div className="flex justify-between mt-2">
            {onPrev ? (
              <button
                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                className="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none px-2 py-1"
              >
                ‹ prev
              </button>
            ) : <span />}
            {onNext ? (
              <button
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                className="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none px-2 py-1"
              >
                next ›
              </button>
            ) : <span />}
          </div>
        </div>
      )}

      <div className="text-[0.93rem] leading-relaxed" style={{ color: "#444" }}>
        {post.caption}
      </div>
    </div>
  );
}
