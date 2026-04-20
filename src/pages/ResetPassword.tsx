import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePassword } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      toast({ title: "Password updated", description: "You're now signed in." });
      navigate("/");
    } catch (err: any) {
      toast({ title: err.message || "Could not update password", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center px-4">
      <div className="bg-background border border-border rounded-sm p-10 w-full max-w-[420px]">
        <h1 className="text-3xl font-light italic mb-1 text-foreground">Reset password</h1>
        <p className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-muted-foreground mb-7">
          {ready ? "Choose a new password" : "Verifying reset link…"}
        </p>

        {ready && (
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-foreground/[0.04] border border-border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-foreground/[0.04] border border-border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="w-full font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2.5 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;