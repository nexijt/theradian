import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, ArrowLeft } from "lucide-react";
import type { FeedPost } from "@/hooks/useFeed";
import AudioPlayer from "./AudioPlayer";
import { getTagColor, normalizeTag } from "@/lib/tag-colors";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PostPanelProps {
  post: FeedPost | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onUserClick?: (username: string) => void;
}

type ReportReason = "inappropriate" | "ai-generated";

export default function PostPanel({ post, onClose, onNext, onPrev, onUserClick }: PostPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportView, setReportView] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Reset report state when post changes
  useEffect(() => {
    setMenuOpen(false);
    setReportView(false);
    setSelectedReason(null);
    setSubmitted(false);
  }, [post?.id]);

  if (!post) return null;

  const isOpen = !!post;
  const locationText = post.location && post.location !== "Unknown" ? post.location : "Somewhere on Earth";
  const tagColor = getTagColor(post.tag, post.type);
  const normalizedTag = post.tag ? normalizeTag(post.tag, post.type) : null;

  const handleOpenReport = () => {
    setMenuOpen(false);
    setReportView(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedReason || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        post_id: post.id,
        reporter_id: user.id,
        reason: selectedReason,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit report. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleCloseReport = () => {
    setReportView(false);
    setSelectedReason(null);
    setSubmitted(false);
  };

  return (
    <div
      className="fixed top-1/2 right-8 z-[60] w-[290px] rounded-sm p-7"
      style={{
        transform: isOpen ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(calc(100% + 48px))",
        transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1)",
        background: "hsl(var(--popover) / 0.97)",
        border: "1px solid hsl(var(--border))",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Top-right controls */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5">
        {/* 3-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-7 h-7 flex items-center justify-center bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors rounded-sm"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute top-full right-0 mt-1 rounded-sm border border-border py-1 z-10"
              style={{ background: "hsl(var(--popover))", minWidth: "120px" }}
            >
              <button
                onClick={handleOpenReport}
                className="w-full text-left px-3.5 py-2 font-mono text-[0.6rem] tracking-[0.1em] uppercase transition-colors hover:bg-foreground/5"
                style={{ color: "hsl(0 72% 51%)" }}
              >
                Report
              </button>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground text-base transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Report view */}
      {reportView ? (
        <div className="pt-1">
          <button
            onClick={handleCloseReport}
            className="flex items-center gap-1.5 font-mono text-[0.55rem] tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-5"
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </button>

          {submitted ? (
            <div className="space-y-4">
              <p className="text-lg font-light italic text-foreground">Report submitted</p>
              <p className="font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground leading-relaxed">
                Thank you. We'll review this post.
              </p>
              <button
                onClick={() => { handleCloseReport(); onClose(); }}
                className="font-mono text-[0.6rem] tracking-[0.14em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-light italic text-foreground mb-1">Report post</p>
                <p className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-muted-foreground">
                  Why are you reporting this?
                </p>
              </div>

              <div className="space-y-2">
                {(["inappropriate", "ai-generated"] as ReportReason[]).map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className="w-full text-left px-3.5 py-3 rounded-sm border transition-all font-mono text-[0.6rem] tracking-[0.1em] uppercase"
                    style={{
                      borderColor: selectedReason === reason ? "hsl(var(--primary))" : "hsl(var(--border))",
                      color: selectedReason === reason ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                      background: selectedReason === reason ? "hsl(var(--primary) / 0.06)" : "transparent",
                    }}
                  >
                    {reason === "inappropriate" ? "Inappropriate" : "AI-generated"}
                  </button>
                ))}
              </div>

              {!user && (
                <p className="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-muted-foreground">
                  Sign in to submit a report
                </p>
              )}

              <button
                onClick={handleSubmitReport}
                disabled={!selectedReason || !user || submitting}
                className="font-mono text-[0.6rem] tracking-[0.14em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="font-mono text-[0.58rem] tracking-[0.14em] uppercase mb-2.5" style={{ color: tagColor.hex }}>
            {normalizedTag ? `[${normalizedTag}] ` : ""}{locationText}
          </div>
          <button
            onClick={onUserClick ? () => onUserClick(post.user) : undefined}
            className={`text-lg font-light italic mb-1 text-foreground bg-transparent border-none p-0 text-left${onUserClick ? " cursor-pointer hover:underline" : " cursor-default"}`}
          >
            @{post.user}
          </button>
          <div className="font-mono text-[0.56rem] text-muted-foreground tracking-[0.1em] mb-4">
            {post.time}
          </div>

          {post.type === "photo" && (
            <div className="relative mb-3.5 flex items-center">
              {onPrev && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  className="absolute -left-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
                >
                  <span className="text-xl font-semibold select-none">‹</span>
                </button>
              )}
              <div className="w-full aspect-square rounded-sm overflow-hidden bg-secondary flex items-center justify-center">
                {post.mediaUrl ? (
                  <img src={post.mediaUrl} alt={post.caption} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-30">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span className="font-mono text-[0.52rem] tracking-[0.14em] uppercase text-muted-foreground">no image</span>
                  </div>
                )}
              </div>
              {onNext && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  className="absolute -right-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
                >
                  <span className="text-xl font-semibold select-none">›</span>
                </button>
              )}
            </div>
          )}

          {post.type === "audio" && (
            <div className="relative mb-3.5 flex items-center">
              {onPrev && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  className="absolute -left-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
                >
                  <span className="text-xl font-semibold select-none">‹</span>
                </button>
              )}
              <div className="w-full">
                {post.mediaUrl ? (
                  <AudioPlayer src={post.mediaUrl} />
                ) : (
                  <div className="w-full rounded-lg bg-secondary px-4 py-5 flex items-center gap-3 opacity-30">
                    <div className="w-9 h-9 rounded-full border border-foreground/20 flex items-center justify-center flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-foreground ml-0.5">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                    <div className="flex items-center gap-[2px] flex-1 h-8">
                      {Array.from({ length: 28 }, (_, i) => (
                        <div key={i} className="flex-1 rounded-sm bg-foreground/40" style={{ height: `${20 + Math.sin(i * 0.8) * 14 + Math.cos(i * 1.3) * 8}%` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {onNext && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  className="absolute -right-6 top-1/2 -translate-y-1/2 w-8 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
                >
                  <span className="text-xl font-semibold select-none">›</span>
                </button>
              )}
            </div>
          )}

          <div className="text-[0.93rem] leading-relaxed text-foreground/75">
            {post.caption}
          </div>
        </>
      )}
    </div>
  );
}
