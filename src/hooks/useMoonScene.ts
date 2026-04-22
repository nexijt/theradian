import { useState, useEffect } from "react";
import { fetchPostsByUserId } from "@/lib/posts";
import { postToFeedPost, type FeedPost } from "@/hooks/useFeed";
import type { Profile } from "@/hooks/useProfile";

const moonTimeFormat = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

export function useMoonScene(profile: Profile | null) {
  const [sceneView, setSceneView] = useState<"earth" | "moon">("earth");
  const [moonMounted, setMoonMounted] = useState(false);
  const [moonPosts, setMoonPosts] = useState<FeedPost[]>([]);
  const [moonPostsLoading, setMoonPostsLoading] = useState(false);
  const [selectedMoonPost, setSelectedMoonPost] = useState<FeedPost | null>(null);

  useEffect(() => {
    if (sceneView === "moon" && profile) {
      setMoonPostsLoading(true);
      fetchPostsByUserId(profile.user_id)
        .then((rows) =>
          setMoonPosts(rows.map((p) => postToFeedPost(p, moonTimeFormat(p.created_at), "Somewhere on Earth")))
        )
        .finally(() => setMoonPostsLoading(false));
    }
  }, [sceneView, profile]);

  const enterMoon = () => {
    setMoonMounted(true);
    setSceneView("moon");
  };

  const exitMoon = () => {
    setSceneView("earth");
    setSelectedMoonPost(null);
  };

  return {
    sceneView,
    moonMounted,
    moonPosts,
    moonPostsLoading,
    selectedMoonPost,
    setSelectedMoonPost,
    enterMoon,
    exitMoon,
  };
}
