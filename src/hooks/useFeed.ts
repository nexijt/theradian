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

export function useFeed() {
  const [currentPosts, setCurrentPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef(0);
  const queueRef = useRef<FeedPost[]>([]);
  const allPostsRef = useRef<FeedPost[]>([]);
  const useMockRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const posts = await fetchPosts(0, 20);
      if (posts.length === 0) {
        useMockRef.current = true;
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
        allPostsRef.current = mocks;
        setCurrentPosts(mocks);
      } else {
        useMockRef.current = false;
        const feedPosts = posts.map(dbPostToFeedPost);
        allPostsRef.current = feedPosts;
        // Show first batch, queue the rest (including location-deferred ones)
        const { visible, deferred } = splitByLocation(feedPosts, 10);
        queueRef.current = deferred;
        setCurrentPosts(visible);
        offsetRef.current = 20;
      }
    } catch {
      useMockRef.current = true;
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
      allPostsRef.current = mocks;
      setCurrentPosts(mocks);
    }
    setLoading(false);
  }, []);

  const loadNextSpin = useCallback(async () => {
    if (useMockRef.current) return;

    // Show queued/deferred posts first
    if (queueRef.current.length > 0) {
      const { visible, deferred } = splitByLocation(queueRef.current, 10);
      queueRef.current = deferred;
      if (visible.length > 0) {
        setCurrentPosts(visible);
        return;
      }
    }

    // Try fetching more from DB
    try {
      const posts = await fetchPosts(offsetRef.current, 20);
      if (posts.length > 0) {
        const feedPosts = posts.map(dbPostToFeedPost);
        allPostsRef.current = [...allPostsRef.current, ...feedPosts];
        const { visible, deferred } = splitByLocation(feedPosts, 10);
        queueRef.current = deferred;
        setCurrentPosts(visible);
        offsetRef.current += 20;
        return;
      }
    } catch {
      // Fall through to loop
    }

    // No more posts — loop back to the beginning
    offsetRef.current = 0;
    if (allPostsRef.current.length > 0) {
      const { visible, deferred } = splitByLocation(allPostsRef.current, 10);
      queueRef.current = deferred;
      setCurrentPosts(visible);
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
