import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import Globe from "@/components/Globe";
import AuthModal from "@/components/AuthModal";
import PostPanel from "@/components/PostPanel";
import CreatePostSheet from "@/components/CreatePostSheet";
import { useAuth } from "@/hooks/useAuth";
import { useFeed, type FeedPost } from "@/hooks/useFeed";
import { useTheme } from "@/hooks/useTheme";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentPosts, loadInitial, loadMore } = useFeed();
  const [authModal, setAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [activeCount, setActiveCount] = useState(Math.floor(Math.random() * 11) + 15);
  const [spinToLon, setSpinToLon] = useState<number | null>(null);
  const { toast } = useToast();
  const visiblePostsRef = useRef<FeedPost[]>([]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setActiveCount((c) => Math.max(15, Math.min(25, c + Math.floor(Math.random() * 3) - 1)));
    }, 3500);
    return () => clearInterval(iv);
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

  return (
    <div className="w-full h-screen overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-9 py-3 sm:py-5 z-50 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-lg sm:text-xl font-light tracking-[0.28em] uppercase">THE RADIAN</span>
          <span className="font-mono text-[0.42rem] tracking-[0.14em] uppercase text-muted-foreground" style={{ marginTop: "-1px", paddingLeft: "2px" }}>ver. 0.1</span>
        </div>
        <div className="flex gap-2 sm:gap-3 pointer-events-auto">
          {user ? (
            <>
              <button
                onClick={handleSignOut}
                className="font-mono text-[0.55rem] sm:text-[0.63rem] tracking-[0.12em] uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm border transition-all hover:border-primary hover:text-primary"
                style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
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
                className="font-mono text-[0.55rem] sm:text-[0.63rem] tracking-[0.12em] uppercase px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm border transition-all hover:border-primary hover:text-primary"
                style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
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
        <div
          className="w-[5px] h-[5px] rounded-full"
          style={{
            background: navigator.onLine ? "#3dba6f" : "#e04040",
            animation: navigator.onLine ? "lp 2.5s ease-in-out infinite" : "none",
          }}
        />
        <span className="font-mono text-[0.48rem] sm:text-[0.56rem] tracking-[0.14em] uppercase text-muted-foreground hidden sm:inline">
          Status: {navigator.onLine ? "Connected" : "Disconnected"}
        </span>
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
    </div>
  );
};

export default Index;
