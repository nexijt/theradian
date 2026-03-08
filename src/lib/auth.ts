import { supabase } from "@/integrations/supabase/client";

const FAKE_DOMAIN = "radian.app";

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${FAKE_DOMAIN}`;
}

export async function signUp(username: string, password: string, displayName?: string) {
  const email = usernameToEmail(username);

  // Check if username is already taken
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase().trim())
    .maybeSingle();

  if (existing) {
    throw new Error("Username is already taken");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || username,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn(username: string, password: string) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile;
}
