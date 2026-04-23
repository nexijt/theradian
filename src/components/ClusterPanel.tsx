import React from "react";
import { X } from "lucide-react";
import type { FeedPost } from "@/hooks/useFeed";
import { getTagColor, normalizeTag } from "@/lib/tag-colors";

interface ClusterPanelProps {
  posts: FeedPost[] | null;
  onClose: () => void;
  onPostClick: (post: FeedPost) => void;
}

export default function ClusterPanel({ posts, onClose, onPostClick }: ClusterPanelProps) {
  if (!posts) return null;

  const location = posts[0]?.location && posts[0].location !== "Unknown"
    ? posts[0].location
    : "this location";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative w-[340px] max-h-[70vh] rounded-sm border border-border flex flex-col overflow-hidden"
        style={{ background: "hsl(var(--popover) / 0.97)", backdropFilter: "blur(12px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="font-mono text-[0.55rem] tracking-[0.18em] uppercase text-muted-foreground">
              {posts.length} logs
            </div>
            <div className="text-sm font-light italic text-foreground/80 mt-0.5">
              {location}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors ml-4"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Post list */}
        <div className="overflow-y-auto flex-1">
          {posts.map((post) => {
            const tagColor = getTagColor(post.tag, post.type);
            const normalizedTag = normalizeTag(post.tag, post.type);
            return (
              <button
                key={post.id}
                onClick={() => { onPostClick(post); onClose(); }}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors text-left border-b border-border/40 last:border-0"
              >
                {/* Tag color strip */}
                <div
                  className="w-0.5 self-stretch rounded-full flex-shrink-0"
                  style={{ background: tagColor.hex }}
                />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span
                      className="font-mono text-[0.44rem] tracking-[0.12em] uppercase flex-shrink-0"
                      style={{ color: tagColor.hex }}
                    >
                      [{normalizedTag}]
                    </span>
                    <span className="text-sm font-light italic text-foreground truncate">
                      @{post.user}
                    </span>
                  </div>
                  <div className="font-mono text-[0.5rem] tracking-[0.1em] text-muted-foreground">
                    {post.time}
                  </div>
                </div>
                {/* Type icon */}
                <div className="text-[0.65rem] text-muted-foreground opacity-50 flex-shrink-0">
                  {post.type === "photo" ? "▣" : "◎"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
