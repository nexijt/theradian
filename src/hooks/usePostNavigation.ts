import { useState, useCallback, useRef } from "react";
import type { FeedPost } from "@/hooks/useFeed";

export function usePostNavigation() {
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [spinToLon, setSpinToLon] = useState<number | null>(null);
  const visiblePostsRef = useRef<FeedPost[]>([]);

  const handleVisiblePostsChange = useCallback((vp: FeedPost[]) => {
    visiblePostsRef.current = vp;
  }, []);

  const handlePostClick = useCallback((post: FeedPost) => {
    setSelectedPost(post);
  }, []);

  const handleNextPost = useCallback(() => {
    if (!selectedPost) return;
    const sorted = [...visiblePostsRef.current].sort((a, b) => a.lon - b.lon);
    if (sorted.length === 0) return;
    const currentLon = selectedPost.lon;
    let next = sorted.find((p) => p.lon > currentLon && p.id !== selectedPost.id);
    if (!next) next = sorted.find((p) => p.id !== selectedPost.id);
    if (!next) return;
    setSelectedPost(next);
    setSpinToLon(next.lon);
  }, [selectedPost]);

  const handlePrevPost = useCallback(() => {
    if (!selectedPost) return;
    const sorted = [...visiblePostsRef.current].sort((a, b) => a.lon - b.lon);
    if (sorted.length === 0) return;
    const currentLon = selectedPost.lon;
    const reversed = [...sorted].reverse();
    let prev = reversed.find((p) => p.lon < currentLon && p.id !== selectedPost.id);
    if (!prev) prev = reversed.find((p) => p.id !== selectedPost.id);
    if (!prev) return;
    setSelectedPost(prev);
    setSpinToLon(prev.lon);
  }, [selectedPost]);

  const clearSelection = useCallback(() => {
    setSelectedPost(null);
    setSpinToLon(null);
  }, []);

  return {
    selectedPost,
    spinToLon,
    visiblePostsRef,
    handleVisiblePostsChange,
    handlePostClick,
    handleNextPost,
    handlePrevPost,
    clearSelection,
  };
}
