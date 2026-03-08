import React, { useState } from "react";
import { signIn, signUp } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "login" | "register";
}

export default function AuthModal({ open, onClose, initialTab = "login" }: AuthModalProps) {
  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (tab === "login") {
        await signIn(username, password);
        toast({ title: "Welcome back!" });
      } else {
        await signUp(username, password, displayName || username);
        toast({ title: "Account created! Welcome to RADIAN." });
      }
      onClose();
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: "hsla(36,24%,94%,0.88)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-background border rounded-sm p-10 w-full max-w-[420px]"
        style={{ borderColor: "hsl(0 0% 10% / 0.11)" }}
      >
        <h2 className="text-3xl font-light italic mb-1">
          {tab === "login" ? "Welcome back" : "Join RADIAN"}
        </h2>
        <p className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-muted-foreground mb-7">
          {tab === "login" ? "Sign in to your account" : "Start posting to the globe"}
        </p>

        <div className="flex mb-7 border-b" style={{ borderColor: "hsl(0 0% 10% / 0.1)" }}>
          <button
            className={`pb-2 mr-6 font-mono text-[0.6rem] tracking-[0.12em] uppercase border-b-2 -mb-px transition-all ${
              tab === "login" ? "text-primary border-primary" : "text-muted-foreground border-transparent"
            }`}
            onClick={() => setTab("login")}
          >
            Sign in
          </button>
          <button
            className={`pb-2 mr-6 font-mono text-[0.6rem] tracking-[0.12em] uppercase border-b-2 -mb-px transition-all ${
              tab === "register" ? "text-primary border-primary" : "text-muted-foreground border-transparent"
            }`}
            onClick={() => setTab("register")}
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              className="w-full bg-foreground/[0.04] border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none transition-colors focus:border-primary"
              style={{ borderColor: "hsl(0 0% 10% / 0.12)" }}
            />
          </div>
          <div>
            <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              className="w-full bg-foreground/[0.04] border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none transition-colors focus:border-primary"
              style={{ borderColor: "hsl(0 0% 10% / 0.12)" }}
            />
          </div>
          {tab === "register" && (
            <div>
              <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you appear on the globe"
                className="w-full bg-foreground/[0.04] border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none transition-colors focus:border-primary"
                style={{ borderColor: "hsl(0 0% 10% / 0.12)" }}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2.5 justify-end mt-6">
          <button
            onClick={onClose}
            className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border transition-all hover:border-primary hover:text-primary"
            style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light disabled:opacity-50"
          >
            {loading ? "..." : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}
