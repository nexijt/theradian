import { supabase } from "@/integrations/supabase/client";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function cleanUsername(u: string) {
  return u.toLowerCase().trim();
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username.trim())) {
    return "Username must be 3–20 chars: letters, numbers, underscore";
  }
  return null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", cleanUsername(username))
    .maybeSingle();
  return !data;
}

export async function signUp(email: string, username: string, password: string) {
  const cleaned = cleanUsername(username);

  const usernameError = validateUsername(cleaned);
  if (usernameError) throw new Error(usernameError);

  const available = await isUsernameAvailable(cleaned);
  if (!available) throw new Error("Username is already taken");

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        username: cleaned,
        display_name: cleaned,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn(emailOrUsername: string, password: string) {
  let email = emailOrUsername.trim();

  // If input doesn't look like an email, treat it as a username and look up the email.
  if (!email.includes("@")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .ilike("username", cleanUsername(email))
      .maybeSingle();

    if (!profile?.email) {
      throw new Error("No account found with that username");
    }
    email = profile.email;
  }

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

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
) {
  // Re-authenticate to confirm the user knows their current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError) throw new Error("Current password is incorrect");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
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
