import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/hooks/useProfile";

interface Props {
  open: boolean;
  onClose: () => void;
  user: User;
  profile: Profile | null;
}

type Category = "bug" | "idea" | "other";

export default function FeedbackModal({ open, onClose, user, profile }: Props) {
  const [category, setCategory] = useState<Category>("idea");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const submit = async () => {
    if (!message.trim()) {
      toast({ title: "Please write a message", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      username: profile?.username ?? null,
      email: user.email ?? null,
      category,
      message: message.trim(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    setLoading(false);
    if (error) {
      toast({ title: error.message || "Could not send feedback", variant: "destructive" });
      return;
    }
    toast({ title: "Thanks — feedback received" });
    setMessage("");
    setCategory("idea");
    onClose();
  };

  const cats: { id: Category; label: string }[] = [
    { id: "bug", label: "Bug" },
    { id: "idea", label: "Idea" },
    { id: "other", label: "Other" },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: "hsl(var(--background) / 0.88)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-sm p-10 w-full max-w-[460px]">
        <h2 className="text-3xl font-light italic mb-1 text-foreground">Send feedback</h2>
        <p className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-muted-foreground mb-7">
          What's working? What's broken? What's missing?
        </p>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
              Category
            </label>
            <div className="flex gap-2">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`font-mono text-[0.55rem] tracking-[0.14em] uppercase px-3 py-1.5 rounded-sm border transition-all ${
                    category === c.id
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              autoFocus
              placeholder="Tell us what you think…"
              className="w-full bg-foreground/[0.04] border border-border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none transition-colors focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2.5 justify-end mt-6">
          <button
            onClick={onClose}
            className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border border-border transition-all hover:border-primary hover:text-primary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}