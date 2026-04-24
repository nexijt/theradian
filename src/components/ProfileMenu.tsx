import React from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/hooks/useProfile";
import { resendVerification } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ProfileMenuProps {
  user: User;
  profile: Profile | null;
  onVisitMoon: () => void;
  onEditProfile: () => void;
  onChangePassword: () => void;
  onSendFeedback: () => void;
  onSignOut: () => void;
}

export default function ProfileMenu({
  user,
  profile,
  onVisitMoon,
  onEditProfile,
  onChangePassword,
  onSendFeedback,
  onSignOut,
}: ProfileMenuProps) {
  const { toast } = useToast();
  const verified = !!user.email_confirmed_at;
  const username = profile?.username ?? user.email?.split("@")[0] ?? "user";
  const email = user.email ?? "";

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!email) return;
    try {
      await resendVerification(email);
      toast({ title: "Verification email sent", description: "Check your inbox." });
    } catch (err: any) {
      toast({ title: err.message || "Could not resend", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="font-mono text-[0.55rem] sm:text-[0.63rem] tracking-[0.12em] uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm border border-border transition-all hover:border-primary hover:text-primary flex items-center gap-1.5">
          @{username}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-60 rounded-sm border-border bg-popover p-0"
      >
        {/* Header */}
        <div className="px-3 pt-3 pb-2.5">
          <div className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-foreground truncate">
            @{username}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{ background: verified ? "#3dba6f" : "#f5a524" }}
            />
            <span className="font-mono text-[0.5rem] tracking-[0.12em] uppercase text-muted-foreground truncate flex-1">
              {email}
            </span>
          </div>
          {!verified && email && (
            <button
              onClick={handleResend}
              className="mt-2 font-mono text-[0.5rem] tracking-[0.12em] uppercase text-primary hover:underline"
            >
              Verify email →
            </button>
          )}
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="py-1">
          <MenuRow onClick={onVisitMoon}>Visit my moon</MenuRow>
          <MenuRow onClick={onEditProfile}>Edit profile</MenuRow>
          <MenuRow onClick={onChangePassword}>Change password</MenuRow>
          <MenuRow onClick={onSendFeedback}>Send feedback</MenuRow>
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="py-1">
          <MenuRow onClick={onSignOut} danger>
            Sign out
          </MenuRow>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuRow({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded-none cursor-pointer font-mono text-[0.58rem] tracking-[0.14em] uppercase px-3 py-2 ${
        danger ? "text-destructive focus:text-destructive" : "text-foreground"
      }`}
    >
      {children}
    </DropdownMenuItem>
  );
}