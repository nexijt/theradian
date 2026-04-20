import React, { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImage, squareImage } from "@/lib/posts";
import type { Profile } from "@/hooks/useProfile";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onSaved: () => void;
}

export default function EditProfileModal({ open, onClose, profile, onSaved }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || profile.username);
  const [bio, setBio] = useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!open) return null;

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const squared = await squareImage(f);
      const compressed = await compressImage(squared, 512, 0.85);
      const path = `${profile.user_id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err: any) {
      toast({ title: err.message || "Avatar upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (bio.length > 200) {
      toast({ title: "Bio must be 200 characters or less", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || profile.username,
          bio: bio.trim() || null,
          avatar_url: avatarUrl || null,
        })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      toast({ title: "Moon updated" });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: err.message || "Save failed", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: "hsl(var(--background) / 0.88)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-sm p-8 w-full max-w-[420px]">
        <h2 className="text-2xl font-light italic mb-1 text-foreground">Edit moon</h2>
        <p className="font-mono text-[0.55rem] tracking-[0.14em] uppercase text-muted-foreground mb-6">
          Your public profile
        </p>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-light italic text-muted-foreground">
                {(displayName || profile.username).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="font-mono text-[0.58rem] tracking-[0.12em] uppercase px-3 py-1.5 rounded-sm border border-border hover:border-primary hover:text-primary transition-all disabled:opacity-50"
            >
              {uploading ? "Uploading…" : avatarUrl ? "Change avatar" : "Upload avatar"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[0.55rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className="w-full bg-foreground/[0.04] border border-border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-mono text-[0.55rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              placeholder="Two lines about yourself…"
              className="w-full bg-foreground/[0.04] border border-border rounded-sm px-3.5 py-2.5 font-serif text-sm text-foreground outline-none focus:border-primary resize-none h-20 leading-relaxed"
            />
            <div className="font-mono text-[0.5rem] tracking-[0.1em] uppercase text-muted-foreground text-right mt-1">
              {bio.length}/200
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 justify-end mt-6">
          <button
            onClick={onClose}
            className="font-mono text-[0.6rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border border-border hover:border-primary hover:text-primary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="font-mono text-[0.6rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground hover:bg-primary-light transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}