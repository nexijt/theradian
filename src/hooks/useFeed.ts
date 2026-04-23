import { useState, useCallback, useRef } from "react";
import { fetchPosts, type PostWithProfile } from "@/lib/posts";
import { MOCK_POSTS } from "@/lib/globe-data";

export interface FeedPost {
  id: string;
  lat: number;
  lon: number;
  user: string;
  location: string;
  caption: string;
  time: string;
  type: "photo" | "audio";
  category?: string;
  mediaUrl?: string;
  displayName?: string;
  tag?: string;
  createdAt: string; // ISO string for ordering
}

function formatPostTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const postDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (postDay.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  } else if (postDay.getTime() === yesterday.getTime()) {
    return `Yesterday at ${timeStr}`;
  } else {
    const dateFormatted = date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    return `Posted on ${dateFormatted} at ${timeStr}`;
  }
}

export function postToFeedPost(post: PostWithProfile, time: string, locationFallback = "Unknown"): FeedPost {
  return {
    id: post.id,
    lat: post.latitude || 0,
    lon: post.longitude || 0,
    user: post.username,
    location: [post.city, post.country].filter(Boolean).join(", ") || locationFallback,
    caption: post.caption || "",
    time,
    type: post.type as "photo" | "audio",
    mediaUrl: post.media_url,
    displayName: post.display_name || undefined,
    tag: post.tag || undefined,
    createdAt: post.created_at,
  };
}

function dbPostToFeedPost(post: PostWithProfile): FeedPost {
  return postToFeedPost(post, formatPostTime(post.created_at));
}


const BATCH_SIZE = 50;

export function useFeed() {
  const [currentPosts, setCurrentPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    offsetRef.current = 0;
    hasMoreRef.current = true;
    try {
      const posts = await fetchPosts(0, BATCH_SIZE);
      if (posts.length === 0) {
        const mocks = MOCK_POSTS.map((p, i) => ({
          id: `mock-${i}`,
          lat: p.lat,
          lon: p.lon,
          user: p.user,
          location: p.location,
          caption: p.caption,
          time: p.time,
          type: p.type as "photo" | "audio",
          category: "category" in p ? (p as any).category : undefined,
          createdAt: new Date().toISOString(),
        } as FeedPost));
        setCurrentPosts(mocks);
        hasMoreRef.current = false;
      } else {
        offsetRef.current = posts.length;
        hasMoreRef.current = posts.length >= BATCH_SIZE;
        setCurrentPosts(posts.map(dbPostToFeedPost));
      }
    } catch {
      const mocks = MOCK_POSTS.map((p, i) => ({
        id: `mock-${i}`,
        lat: p.lat,
        lon: p.lon,
        user: p.user,
        location: p.location,
        caption: p.caption,
        time: p.time,
        type: p.type as "photo" | "audio",
        category: "category" in p ? (p as any).category : undefined,
        createdAt: new Date().toISOString(),
      } as FeedPost));
      setCurrentPosts(mocks);
      hasMoreRef.current = false;
    }
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current || loading) return;
    setLoading(true);
    try {
      const posts = await fetchPosts(offsetRef.current, BATCH_SIZE);
      if (posts.length === 0) {
        hasMoreRef.current = false;
      } else {
        offsetRef.current += posts.length;
        hasMoreRef.current = posts.length >= BATCH_SIZE;
        const newFeedPosts = posts.map(dbPostToFeedPost);
        setCurrentPosts(prev => [...prev, ...newFeedPosts]);
      }
    } catch (err) {
      console.error("useFeed.loadMore failed:", err);
    }
    setLoading(false);
  }, [loading]);

  return { currentPosts, loading, loadInitial, loadMore, hasMore: hasMoreRef.current };
}
