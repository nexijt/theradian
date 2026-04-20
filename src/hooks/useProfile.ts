import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

/** Profile for the currently authenticated user */
export function useMyProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { profile, loading, refresh };
}

/** Look up a profile by username (case-insensitive) */
export function useProfileByUsername(username: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!username) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setNotFound(false);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", username)
        .maybeSingle();
      if (cancelled) return;
      if (!data) setNotFound(true);
      setProfile((data as Profile) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [username]);

  return { profile, loading, notFound };
}