import React, { useState, useEffect, useCallback } from "react";
import Globe from "@/components/Globe";
import AuthModal from "@/components/AuthModal";
import PostPanel from "@/components/PostPanel";
import CreatePostSheet from "@/components/CreatePostSheet";
import { useAuth } from "@/hooks/useAuth";
import { useFeed, type FeedPost } from "@/hooks/useFeed";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentPosts, loadInitial, loadNextSpin } = useFeed();
  const [authModal, setAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [activeCount, setActiveCount] = useState(247);
  const { toast } = useToast();

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setActiveCount((c) => c + Math.floor(Math.random() * 6) - 2);
    }, 3500);
    return () => clearInterval(iv);
  }, []);

  const handlePostClick = useCallback((post: FeedPost) => {
    setSelectedPost(post);
    setShowHint(false);
  }, []);

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
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-9 py-5 z-50 pointer-events-none">
        <span className="text-xl font-light tracking-[0.28em] uppercase">RADIAN</span>
        <div className="flex gap-3 pointer-events-auto">
          {user ? (
            <>
              <button
                onClick={handleSignOut}
                className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border transition-all hover:border-primary hover:text-primary"
                style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
              >
                Sign out
              </button>
              <button
                onClick={handlePost}
                className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light"
              >
                Post today
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleOpenAuth("login")}
                className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border transition-all hover:border-primary hover:text-primary"
                style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
              >
                Sign in
              </button>
              <button
                onClick={handlePost}
                className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light"
              >
                Post today
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Globe */}
      <Globe
        posts={currentPosts}
        onPostClick={handlePostClick}
        onSpinComplete={loadNextSpin}
      />

      {/* Hint */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 font-mono text-[0.58rem] tracking-[0.2em] uppercase text-muted-foreground z-50 pointer-events-none transition-opacity duration-1000"
        style={{ opacity: showHint ? 1 : 0 }}
      >
        Drag to explore · Click a dot to open a post
      </div>

      {/* Live count */}
      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-2 pointer-events-none">
        <div
          className="w-[5px] h-[5px] bg-primary rounded-full"
          style={{ animation: "lp 2.5s ease-in-out infinite" }}
        />
        <span className="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-muted-foreground">
          {activeCount} active now
        </span>
      </div>

      {/* Status indicator */}
      <div className="fixed bottom-8 left-8 z-50 flex items-center gap-2 pointer-events-none">
        <div
          className="w-[5px] h-[5px] rounded-full"
          style={{
            background: navigator.onLine ? "#3dba6f" : "#e04040",
            animation: navigator.onLine ? "lp 2.5s ease-in-out infinite" : "none",
          }}
        />
        <span className="font-mono text-[0.56rem] tracking-[0.14em] uppercase text-muted-foreground">
          Status: {navigator.onLine ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Post panel (right side) */}
      <PostPanel post={selectedPost} onClose={() => setSelectedPost(null)} />

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
