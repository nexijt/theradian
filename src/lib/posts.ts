import { supabase } from "@/integrations/supabase/client";

export interface PostWithProfile {
  id: string;
  type: string;
  caption: string | null;
  media_url: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
  created_at: string;
  user_id: string;
  username: string;
  display_name: string | null;
  tag: string | null;
}

export async function fetchPosts(offset: number, limit: number = 20): Promise<PostWithProfile[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const userIds = [...new Set(posts.map(p => p.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, display_name")
    .in("user_id", userIds);

  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

  return posts.map(post => {
    const profile = profileMap.get(post.user_id);
    return {
      ...post,
      username: profile?.username || "anonymous",
      display_name: profile?.display_name || null,
    };
  });
}

export async function hasPostedToday(userId: string, type: "photo" | "audio"): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", today.toISOString());

  return (count || 0) > 0;
}

export async function createPost(params: {
  userId: string;
  type: "photo" | "audio";
  file: File;
  caption?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  tag?: string;
}) {
  const bucket = params.type === "photo" ? "photos" : "audio";
  const ext = params.file.name.split(".").pop();
  const filePath = `${params.userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, params.file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: params.userId,
      type: params.type,
      media_url: urlData.publicUrl,
      caption: params.caption || null,
      latitude: params.latitude || null,
      longitude: params.longitude || null,
      city: params.city || null,
      country: params.country || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function squareImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = Math.max(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f4f1eb";
      ctx.fillRect(0, 0, size, size);
      const x = (size - img.width) / 2;
      const y = (size - img.height) / 2;
      ctx.drawImage(img, x, y);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to create square image"));
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.9
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
