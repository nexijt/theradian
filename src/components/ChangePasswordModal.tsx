import React, { useState } from "react";
import { changePassword } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
}

export default function ChangePasswordModal({ open, onClose, email }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const reset = () => { setCurrent(""); setNext(""); setConfirm(""); };

  const submit = async () => {
    if (!current || !next || !confirm) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (next.length < 6) {
      toast({ title: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (next !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await changePassword(email, current, next);
      toast({ title: "Password updated" });
      reset();
      onClose();
    } catch (err: any) {
      toast({ title: err.message || "Could not update password", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: "hsl(var(--background) / 0.88)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-sm p-10 w-full max-w-[420px]">
        <h2 className="text-3xl font-light italic mb-1 text-foreground">Change password</h2>
        <p className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-muted-foreground mb-7">
          Confirm current, then set a new one
        </p>

        <div className="space-y-4">
          <Field label="Current password" value={current} onChange={setCurrent} type="password" autoFocus />
          <Field label="New password" value={next} onChange={setNext} type="password" placeholder="at least 6 characters" />
          <Field label="Confirm new password" value={confirm} onChange={setConfirm} type="password" />
        </div>

        <div className="flex gap-2.5 justify-end mt-6">
          <button
            onClick={() => { reset(); onClose(); }}
            className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border border-border transition-all hover:border-primary hover:text-primary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light disabled:opacity-50"
          >
            {loading ? "..." : "Update password"}
          </button>
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