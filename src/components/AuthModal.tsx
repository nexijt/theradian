import React, { useState } from "react";
import { signIn, signUp, requestPasswordReset, validateUsername } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "login" | "register";
}

type Mode = "login" | "register" | "forgot";

export default function AuthModal({ open, onClose, initialTab = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialTab);
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const reset = () => { setEmail(""); setIdentifier(""); setUsername(""); setPassword(""); };

  const switchMode = (m: Mode) => { setMode(m); reset(); };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === "login") {
        if (!identifier.trim() || !password.trim()) throw new Error("Please fill in all fields");
        await signIn(identifier, password);
        toast({ title: "Welcome back!" });
        onClose();
        reset();
      } else if (mode === "register") {
        if (!email.trim() || !username.trim() || !password.trim()) throw new Error("Please fill in all fields");
        if (!email.includes("@")) throw new Error("Enter a valid email");
        const usernameError = validateUsername(username);
        if (usernameError) throw new Error(usernameError);
        if (password.length < 6) throw new Error("Password must be at least 6 characters");

        await signUp(email, username, password);
        toast({
          title: "Check your email",
          description: "Click the link we sent to verify your account.",
        });
        onClose();
        reset();
      } else {
        if (!email.trim() || !email.includes("@")) throw new Error("Enter the email you registered with");
        await requestPasswordReset(email);
        toast({ title: "Reset link sent", description: "Check your email." });
        switchMode("login");
      }
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    }
    setLoading(false);
  };

  const title =
    mode === "login" ? "Welcome back" :
    mode === "register" ? "Join RADIAN" : "Reset password";
  const subtitle =
    mode === "login" ? "Sign in to your account" :
    mode === "register" ? "Start posting to the globe" : "We'll email you a reset link";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: "hsl(var(--background) / 0.88)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-sm p-10 w-full max-w-[420px]">
        <h2 className="text-3xl font-light italic mb-1 text-foreground">{title}</h2>
        <p className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-muted-foreground mb-7">
          {subtitle}
        </p>

        {mode !== "forgot" && (
          <div className="flex mb-7 border-b border-border">
            <button
              className={`pb-2 mr-6 font-mono text-[0.6rem] tracking-[0.12em] uppercase border-b-2 -mb-px transition-all ${
                mode === "login" ? "text-primary border-primary" : "text-muted-foreground border-transparent"
              }`}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              className={`pb-2 mr-6 font-mono text-[0.6rem] tracking-[0.12em] uppercase border-b-2 -mb-px transition-all ${
                mode === "register" ? "text-primary border-primary" : "text-muted-foreground border-transparent"
              }`}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>
        )}

        <div className="space-y-4">
          {mode === "login" && (
            <>
              <Field label="Email or username" value={identifier} onChange={setIdentifier} placeholder="you@example.com" autoFocus />
              <Field label="Password" value={password} onChange={setPassword} placeholder="········" type="password" />
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot password?
              </button>
            </>
          )}

          {mode === "register" && (
            <>
              <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoFocus />
              <Field label="Username" value={username} onChange={setUsername} placeholder="your_handle" />
              <Field label="Password" value={password} onChange={setPassword} placeholder="at least 6 characters" type="password" />
            </>
          )}

          {mode === "forgot" && (
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoFocus />
          )}
        </div>

        <div className="flex gap-2.5 justify-between items-center mt-6">
          <div>
            {mode === "forgot" && (
              <button
                onClick={() => switchMode("login")}
                className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border border-border transition-all hover:border-primary hover:text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light disabled:opacity-50"
            >
              {loading ? "..." :
                mode === "login" ? "Sign in" :
                mode === "register" ? "Create account" : "Send reset link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-foreground/[0.04] border border-border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}
