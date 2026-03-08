import { useState, useCallback } from "react";
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
  type: "photo" | "audio" | "dot";
  category?: string;
  mediaUrl?: string;
  displayName?: string;
  tag?: string;
}

function dbPostToFeedPost(post: PostWithProfile): FeedPost {
  const time = new Date(post.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const location = [post.city, post.country].filter(Boolean).join(", ") || "Unknown";
  return {
    id: post.id,
    lat: post.latitude || 0,
    lon: post.longitude || 0,
    user: post.username,
    location,
    caption: post.caption || "",
    time,
    type: post.type as "photo" | "audio",
    mediaUrl: post.media_url,
    displayName: post.display_name || undefined,
    tag: post.tag || undefined,
  };
}

// Offset posts that share the same rounded lat/lon so they don't overlap
function spreadOverlapping(posts: FeedPost[]): FeedPost[] {
  const buckets = new Map<string, FeedPost[]>();
  for (const p of posts) {
    const key = `${Math.round(p.lat)},${Math.round(p.lon)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }

  const result: FeedPost[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      group.forEach((p, i) => {
        const angle = (i / group.length) * Math.PI * 2;
        const offset = 3 + i * 1.5; // degrees offset
        result.push({
          ...p,
          lat: p.lat + Math.sin(angle) * offset,
          lon: p.lon + Math.cos(angle) * offset,
        });
      });
    }
  }
  return result;
}

export function useFeed() {
  const [currentPosts, setCurrentPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      // Load all posts (up to 200)
      const posts = await fetchPosts(0, 200);
      if (posts.length === 0) {
        const mocks = MOCK_POSTS.map((p, i) => ({
          id: `mock-${i}`,
          lat: p.lat,
          lon: p.lon,
          user: p.user,
          location: p.location,
          caption: p.caption,
          time: p.time,
          type: p.type === "dot" ? "dot" : p.type as "photo" | "audio",
          category: "category" in p ? (p as any).category : undefined,
        } as FeedPost));
        setCurrentPosts(mocks);
      } else {
        const feedPosts = posts.map(dbPostToFeedPost);
        setCurrentPosts(spreadOverlapping(feedPosts));
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
        type: p.type === "dot" ? "dot" : p.type as "photo" | "audio",
        category: "category" in p ? (p as any).category : undefined,
      } as FeedPost));
      setCurrentPosts(mocks);
    }
    setLoading(false);
  }, []);

  return { currentPosts, loading, loadInitial };
}
