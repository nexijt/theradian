import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Globe from "@/components/Globe";
import AuthModal from "@/components/AuthModal";
import PostPanel from "@/components/PostPanel";
import CreatePostSheet from "@/components/CreatePostSheet";
import LandingOverlay from "@/components/LandingOverlay";
import OrbitingMoon from "@/components/OrbitingMoon";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useProfile";
import { useFeed, type FeedPost } from "@/hooks/useFeed";
import { useTheme } from "@/hooks/useTheme";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const LANDING_SEEN_KEY = "radian-landing-seen";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useMyProfile(user);
  const navigate = useNavigate();
  const { currentPosts, loadInitial, loadMore } = useFeed();
  const { theme, toggle: toggleTheme } = useTheme();
  const [authModal, setAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [activeCount, setActiveCount] = useState(1);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [spinToLon, setSpinToLon] = useState<number | null>(null);
  const [landingOpen, setLandingOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(LANDING_SEEN_KEY);
  });
  const { toast } = useToast();
  const visiblePostsRef = useRef<FeedPost[]>([]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5500);
    return () => clearTimeout(t);
  }, []);

  // Track real online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Track real active users via Supabase Realtime Presence
  useEffect(() => {
    const presenceKey = crypto.randomUUID();
    const channel = supabase.channel("theradian:presence", {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setActiveCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleVisiblePostsChange = useCallback((vp: FeedPost[]) => {
    visiblePostsRef.current = vp;
  }, []);

  const handlePostClick = useCallback((post: FeedPost) => {
    setSelectedPost(post);
    setShowHint(false);
  }, []);

  const handleNextPost = useCallback(() => {
    if (!selectedPost) return;
    // Sort visible posts by longitude, find next higher lon
    const sorted = [...visiblePostsRef.current].sort((a, b) => a.lon - b.lon);
    if (sorted.length === 0) return;
    const currentLon = selectedPost.lon;
    // Find first post with higher longitude
    let next = sorted.find(p => p.lon > currentLon && p.id !== selectedPost.id);
    // Wrap around
    if (!next) next = sorted.find(p => p.id !== selectedPost.id);
    if (!next) return;
    setSelectedPost(next);
    setSpinToLon(next.lon);
  }, [selectedPost]);

  const handlePrevPost = useCallback(() => {
    if (!selectedPost) return;
    const sorted = [...visiblePostsRef.current].sort((a, b) => a.lon - b.lon);
    if (sorted.length === 0) return;
    const currentLon = selectedPost.lon;
    // Find last post with lower longitude
    const reversed = [...sorted].reverse();
    let prev = reversed.find(p => p.lon < currentLon && p.id !== selectedPost.id);
    if (!prev) prev = reversed.find(p => p.id !== selectedPost.id);
    if (!prev) return;
    setSelectedPost(prev);
    setSpinToLon(prev.lon);
  }, [selectedPost]);

  const handleOpenAuth = (tab: "login" | "register") => {
    setAuthTab(tab);
    setAuthModal(true);
  };

  const handlePost = () => {
    if (!user) {
      handleOpenAuth("login");
      return;
    }
    setCreateOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out" });
  };

  const dismissLanding = () => {
    localStorage.setItem(LANDING_SEEN_KEY, "1");
    setLandingOpen(false);
  };

  const goToMyMoon = () => {
    if (profile?.username) navigate(`/@${profile.username}`);
  };

  return (
    <div className="w-full h-screen overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-9 py-3 sm:py-5 z-50 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-lg sm:text-xl font-light tracking-[0.28em] uppercase">THE RADIAN</span>
          <span className="font-mono text-[0.42rem] tracking-[0.14em] uppercase text-muted-foreground" style={{ marginTop: "-1px", paddingLeft: "2px" }}>ver. 0.1</span>
        </div>
        <div className="flex gap-2 sm:gap-3 pointer-events-auto items-center">
          <button
            onClick={() => setLandingOpen(true)}
            className="font-mono text-[0.55rem] sm:text-[0.6rem] tracking-[0.18em] uppercase text-muted-foreground hover:text-primary transition-colors mr-1 hidden sm:inline"
          >
            About
          </button>
          {user ? (
            <>
              <button
                onClick={handleSignOut}
                className="font-mono text-[0.55rem] sm:text-[0.63rem] tracking-[0.12em] uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm border border-border transition-all hover:border-primary hover:text-primary"
              >
                Sign out
              </button>
              <button
                onClick={handlePost}
                className="font-mono text-[0.55rem] sm:text-[0.63rem] tracking-[0.12em] uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light"
              >
                Log today
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleOpenAuth("login")}
                className="font-mono text-[0.55rem] sm:text-[0.63rem] tracking-[0.12em] uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm border border-border transition-all hover:border-primary hover:text-primary"
              >
                Sign in
              </button>
              <button
                onClick={handlePost}
                className="font-mono text-[0.55rem] sm:text-[0.63rem] tracking-[0.12em] uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light"
              >
                Log today
              </button>
            </>
          )}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-sm border border-border text-muted-foreground transition-all hover:border-primary hover:text-primary"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </nav>

      {/* Globe */}
      <Globe
        posts={currentPosts}
        onPostClick={handlePostClick}
        paused={!!selectedPost}
        onNeedMore={loadMore}
        selectedPostId={selectedPost?.id}
        spinToLon={spinToLon}
        onVisiblePostsChange={handleVisiblePostsChange}
      />

      {/* Hint */}
      <div
        className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 font-mono text-[0.5rem] sm:text-[0.58rem] tracking-[0.2em] uppercase text-muted-foreground z-50 pointer-events-none whitespace-nowrap"
      >
        Drag to explore · Click a log to view
      </div>

      {/* Live count */}
      <div className="fixed bottom-6 sm:bottom-8 right-4 sm:right-8 z-50 flex items-center gap-2 pointer-events-none">
        <div
          className="w-[5px] h-[5px] bg-primary rounded-full"
          style={{ animation: "lp 2.5s ease-in-out infinite" }}
        />
        <span className="font-mono text-[0.48rem] sm:text-[0.56rem] tracking-[0.14em] uppercase text-muted-foreground hidden sm:inline">
          {activeCount} active now
        </span>
      </div>

      {/* Status indicator */}
      <div className="fixed bottom-6 sm:bottom-8 left-4 sm:left-8 z-50 flex items-center gap-2 pointer-events-none">
        <div className="flex flex-col gap-1">
          {profile?.username && (
            <div className="flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-primary" style={{ animation: "lp 2.5s ease-in-out infinite" }} />
              <span className="font-mono text-[0.48rem] sm:text-[0.56rem] tracking-[0.14em] uppercase hidden sm:inline text-foreground">
                Signal: {profile.username}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div
              className="w-[5px] h-[5px] rounded-full"
              style={{
                background: isOnline ? "#3dba6f" : "#e04040",
                animation: isOnline ? "lp 2.5s ease-in-out infinite" : "none",
              }}
            />
            <span
              className="font-mono text-[0.48rem] sm:text-[0.56rem] tracking-[0.14em] uppercase hidden sm:inline"
              style={{ color: isOnline ? undefined : "#e04040" }}
            >
              Status: {isOnline ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Post panel (right side) */}
      <PostPanel
        post={selectedPost}
        onClose={() => { setSelectedPost(null); setSpinToLon(null); }}
        onNext={handleNextPost}
        onPrev={handlePrevPost}
      />

      {/* Auth modal */}
      <AuthModal
        open={authModal}
        onClose={() => setAuthModal(false)}
        initialTab={authTab}
      />

      {/* Create post sheet (left side) */}
      {user && (
        <CreatePostSheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          userId={user.id}
          onPostCreated={loadInitial}
        />
      )}

      {/* Orbiting moon — only when signed in, links to your profile */}
      {user && profile?.username && (
        <OrbitingMoon onClick={goToMyMoon} label={`@${profile.username}`} />
      )}

      {/* Landing overlay (first visit + manual reopen) */}
      <LandingOverlay open={landingOpen} onEnter={dismissLanding} />
    </div>
  );
};

export default Index;
