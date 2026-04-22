import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [visitedProfile, setVisitedProfile] = useState<Profile | null>(null);

  // Load own posts when entering own moon (not when visiting someone else's)
  useEffect(() => {
    if (sceneView === "moon" && profile && !visitedProfile) {
      setMoonPostsLoading(true);
      fetchPostsByUserId(profile.user_id)
        .then((rows) =>
          setMoonPosts(rows.map((p) => postToFeedPost(p, moonTimeFormat(p.created_at), "Somewhere on Earth")))
        )
        .finally(() => setMoonPostsLoading(false));
    }
  }, [sceneView, profile, visitedProfile]);

  const enterMoon = () => {
    setMoonMounted(true);
    setSceneView("moon");
  };

  const exitMoon = () => {
    setSceneView("earth");
    setSelectedMoonPost(null);
    setVisitedProfile(null);
    setMoonPosts([]);
  };

  const visitUserMoon = async (username: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", username)
      .maybeSingle();

    if (!data) return;

    const visited = data as Profile;
    setVisitedProfile(visited);
    setMoonPosts([]);
    setMoonPostsLoading(true);
    setSelectedMoonPost(null);
    setMoonMounted(true);
    setSceneView("moon");

    fetchPostsByUserId(visited.user_id)
      .then((rows) =>
        setMoonPosts(rows.map((p) => postToFeedPost(p, moonTimeFormat(p.created_at), "Somewhere on Earth")))
      )
      .finally(() => setMoonPostsLoading(false));
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
    visitUserMoon,
    visitedProfile,
    isVisiting: visitedProfile !== null,
  };
}
