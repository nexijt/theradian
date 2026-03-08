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
  type: "photo" | "audio" | "dot";
  category?: string;
  mediaUrl?: string;
  displayName?: string;
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
  };
}

export function useFeed() {
  const [currentPosts, setCurrentPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef(0);
  const queueRef = useRef<FeedPost[]>([]);
  const useMockRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const posts = await fetchPosts(0, 20);
      if (posts.length === 0) {
        // Use mock data as fallback
        useMockRef.current = true;
        setCurrentPosts(MOCK_POSTS.map((p, i) => ({
          id: `mock-${i}`,
          lat: p.lat,
          lon: p.lon,
          user: p.user,
          location: p.location,
          caption: p.caption,
          time: p.time,
          type: p.type === "dot" ? "dot" : p.type as "photo" | "audio",
          category: "category" in p ? (p as any).category : undefined,
        })));
      } else {
        useMockRef.current = false;
        const feedPosts = posts.map(dbPostToFeedPost);
        // Show first 10, queue the rest
        const visible = filterByLocation(feedPosts.slice(0, 10));
        const queued = feedPosts.slice(10);
        queueRef.current = queued;
        setCurrentPosts(visible);
        offsetRef.current = 20;
      }
    } catch {
      // Fallback to mocks
      useMockRef.current = true;
      setCurrentPosts(MOCK_POSTS.map((p, i) => ({
        id: `mock-${i}`,
        lat: p.lat,
        lon: p.lon,
        user: p.user,
        location: p.location,
        caption: p.caption,
        time: p.time,
        type: p.type === "dot" ? "dot" : p.type as "photo" | "audio",
        category: "category" in p ? (p as any).category : undefined,
      })));
    }
    setLoading(false);
  }, []);

  const loadNextSpin = useCallback(async () => {
    if (useMockRef.current) return; // Mock data doesn't paginate

    // First show queued posts
    if (queueRef.current.length > 0) {
      const next = filterByLocation(queueRef.current.splice(0, 10));
      setCurrentPosts(next);
      return;
    }

    // Fetch more from DB
    try {
      const posts = await fetchPosts(offsetRef.current, 20);
      if (posts.length === 0) {
        offsetRef.current = 0; // Loop back
        return;
      }
      const feedPosts = posts.map(dbPostToFeedPost);
      const visible = filterByLocation(feedPosts.slice(0, 10));
      queueRef.current = feedPosts.slice(10);
      setCurrentPosts(visible);
      offsetRef.current += 20;
    } catch {
      // Keep current posts
    }
  }, []);

  return { currentPosts, loading, loadInitial, loadNextSpin };
}

// Ensure no two posts from same location appear in the same batch
function filterByLocation(posts: FeedPost[]): FeedPost[] {
  const seen = new Set<string>();
  const result: FeedPost[] = [];
  const deferred: FeedPost[] = [];

  for (const post of posts) {
    const key = `${Math.round(post.lat)},${Math.round(post.lon)}`;
    if (seen.has(key)) {
      deferred.push(post);
    } else {
      seen.add(key);
      result.push(post);
    }
  }

  return result;
}
