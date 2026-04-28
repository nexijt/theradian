import React, { useState, useEffect, useRef } from "react";
import { Moon, Sun, Edit2, Eye, EyeOff } from "lucide-react";
import Globe from "@/components/Globe";
import MoonScene from "@/components/Moon";
import AuthModal from "@/components/AuthModal";
import PostPanel from "@/components/PostPanel";
import ClusterPanel from "@/components/ClusterPanel";
import CreatePostSheet from "@/components/CreatePostSheet";
import LandingOverlay from "@/components/LandingOverlay";
import GlobeTimeline from "@/components/GlobeTimeline";
import OrbitingMoon from "@/components/OrbitingMoon";
import EditProfileModal from "@/components/EditProfileModal";
import ProfileMenu from "@/components/ProfileMenu";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import FeedbackModal from "@/components/FeedbackModal";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useProfile";
import { useFeed, type FeedPost } from "@/hooks/useFeed";
import { useTheme } from "@/hooks/useTheme";
import { usePresence } from "@/hooks/usePresence";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePostNavigation } from "@/hooks/usePostNavigation";
import { useMoonScene } from "@/hooks/useMoonScene";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const LANDING_SEEN_KEY = "radian-landing-seen";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, refresh: refreshMyProfile } = useMyProfile(user);
  const { currentPosts, loadInitial, loadMore } = useFeed();
  const { theme, toggle: toggleTheme } = useTheme();
  const { activeCount } = usePresence();
  const { isOnline } = useOnlineStatus();
  const postNav = usePostNavigation();
  const moonScene = useMoonScene(profile);
  const { toast } = useToast();

  const globeRotationRef = useRef(0);
  const globeRotateDeltaRef = useRef(0);

  const [cleanView, setCleanView] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("radian-clean-view") === "1"
  );

  const toggleCleanView = () => {
    setCleanView((prev) => {
      const next = !prev;
      localStorage.setItem("radian-clean-view", next ? "1" : "0");
      return next;
    });
  };

  const [authModal, setAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [clusterPanelPosts, setClusterPanelPosts] = useState<import("@/hooks/useFeed").FeedPost[] | null>(null);
  const [landingOpen, setLandingOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(LANDING_SEEN_KEY);
  });

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5500);
    return () => clearTimeout(t);
  }, []);

  const handleOpenAuth = (tab: "login" | "register") => {
    setAuthTab(tab);
    setAuthModal(true);
  };

  const handlePost = () => {
    if (!user) { handleOpenAuth("login"); return; }
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
    if (!user || !profile?.username) return;
    moonScene.enterMoon();
    postNav.clearSelection();
  };

  const onPostClick = (post: FeedPost) => {
    postNav.handlePostClick(post);
    setShowHint(false);
  };

  const handleUserClick = (username: string) => {
    visitUserMoon(username);
    postNav.clearSelection();
  };

  const displayName = profile?.display_name || profile?.username || "";

  const { sceneView, moonMounted, moonPosts, moonPostsLoading, selectedMoonPost, setSelectedMoonPost, exitMoon, visitUserMoon, visitedProfile, isVisiting } = moonScene;
  const { selectedPost, spinToLon, visiblePostsRef, handleVisiblePostsChange, handleNextPost, handlePrevPost, clearSelection } = postNav;

  const activePost = sceneView === "earth" ? selectedPost : selectedMoonPost;
  const closeActivePost = sceneView === "earth" ? clearSelection : () => setSelectedMoonPost(null);

  return (
    <div className="w-full h-screen overflow-hidden">
      {/* ── EARTH GLOBE SCENE ──────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          transformOrigin: "bottom left",
          transform: sceneView === "moon" ? "scale(0.32)" : "scale(1)",
          opacity: sceneView === "moon" ? 0.96 : 1,
          transition:
            "transform 1.4s cubic-bezier(0.16,1,0.3,1), opacity 1.1s ease",
          zIndex: 5,
          pointerEvents: sceneView === "moon" ? "none" : "auto",
          borderRadius: sceneView === "moon" ? "8px" : "0",
          overflow: "hidden",
        }}
      >
        <Globe
          posts={currentPosts}
          onPostClick={onPostClick}
          onClusterClick={setClusterPanelPosts}
          paused={!!selectedPost}
          onNeedMore={loadMore}
          selectedPostId={selectedPost?.id}
          spinToLon={spinToLon}
          onVisiblePostsChange={handleVisiblePostsChange}
          rotationRef={globeRotationRef}
          rotateDeltaRef={globeRotateDeltaRef}
          cleanView={cleanView}
        />
      </div>

      {/* Clickable overlay for mini-globe (in moon view) */}
      {moonMounted && (
        <button
          onClick={exitMoon}
          aria-label="Back to Earth globe"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "32vw",
            height: "32vh",
            zIndex: 7,
            cursor: sceneView === "moon" ? "pointer" : "default",
            background: "transparent",
            border: "none",
            display: sceneView === "moon" ? "block" : "none",
          }}
        />
      )}

      {/* Mini-globe label (earth in moon view) */}
      {moonMounted && sceneView === "moon" && (
        <div
          className="font-mono-ui"
          style={{
            position: "fixed",
            bottom: "calc(32vh + 6px)",
            left: 8,
            fontSize: "0.42rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "hsl(var(--muted-foreground))",
            zIndex: 8,
            pointerEvents: "none",
            opacity: cleanView ? 0 : sceneView === "moon" ? 1 : 0,
            transition: "opacity 0.5s ease 0.9s",
          }}
        >
          ← GLOBE
        </div>
      )}

      {/* ── MOON SCENE ─────────────────────────────────────────────── */}
      {moonMounted && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            transformOrigin: "bottom right",
            transform: sceneView === "moon" ? "scale(1)" : "scale(0.08)",
            opacity: sceneView === "moon" ? 1 : 0,
            transition:
              "transform 1.4s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease",
            pointerEvents: sceneView === "moon" ? "auto" : "none",
            zIndex: 6,
          }}
        >
          <MoonScene posts={moonPosts} onPostClick={setSelectedMoonPost} />
        </div>
      )}

      {/* ── PROFILE CARD (moon view) ────────────────────────────────── */}
      {moonMounted && !cleanView && (isVisiting ? visitedProfile : profile) && (() => {
        const cardProfile = isVisiting ? visitedProfile! : profile!;
        const cardName = cardProfile.display_name || cardProfile.username;
        return (
          <div
            className="fixed top-1/2 left-4 sm:left-8 -translate-y-1/2 z-40 w-[260px] max-w-[80vw] p-6 rounded-sm border border-border"
            style={{
              background: "hsl(var(--popover) / 0.85)",
              backdropFilter: "blur(10px)",
              opacity: sceneView === "moon" ? 1 : 0,
              transform:
                sceneView === "moon"
                  ? "translateY(-50%) translateX(0)"
                  : "translateY(-50%) translateX(-18px)",
              transition:
                "opacity 0.7s ease 0.5s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s",
              pointerEvents: sceneView === "moon" ? "auto" : "none",
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                {cardProfile.avatar_url ? (
                  <img
                    src={cardProfile.avatar_url}
                    alt={cardName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-light italic text-muted-foreground">
                    {cardName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-light italic truncate text-foreground">
                  {cardName}
                </div>
                <div className="font-mono text-[0.55rem] tracking-[0.14em] uppercase text-muted-foreground truncate">
                  @{cardProfile.username}
                </div>
              </div>
            </div>

            {cardProfile.bio && (
              <p className="font-serif text-sm text-foreground/80 leading-relaxed mb-4 italic">
                {cardProfile.bio}
              </p>
            )}

            <div className="font-mono text-[0.55rem] tracking-[0.14em] uppercase text-muted-foreground mb-4">
              {moonPostsLoading
                ? "…"
                : `${moonPosts.length} ${moonPosts.length === 1 ? "log" : "logs"}`}
            </div>

            {!isVisiting && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 font-mono text-[0.55rem] tracking-[0.14em] uppercase px-3 py-1.5 rounded-sm border border-border hover:border-primary hover:text-primary transition-all"
              >
                <Edit2 className="w-3 h-3" />
                Edit moon
              </button>
            )}
          </div>
        );
      })()}

      {/* ── CLEAN VIEW TOGGLE (fixed, always present) ───────────────── */}
      {/* Sits just below the dark mode button. 10px padding on the wrapper  */}
      {/* extends the hover zone so the button fades in when mouse is "near". */}
      {/* mobile:  nav py-3(12)+btn h-8(32)+6px gap = 50px from top, right=px-4(16px) */}
      {/* desktop: nav py-5(20)+btn h-9(36)+6px gap = 62px from top, right=px-9(36px) */}
      {/* We subtract the 10px padding from the container offset to compensate. */}
      <div
        className="fixed z-[200] group p-[10px] top-[40px] right-[6px] sm:top-[52px] sm:right-[26px]"
        style={{ pointerEvents: "auto" }}
      >
        <button
          onClick={toggleCleanView}
          aria-label={cleanView ? "Exit clean view" : "Clean view"}
          title={cleanView ? "Exit clean view" : "Clean view"}
          className={[
            "w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-sm",
            "border border-border text-muted-foreground transition-all duration-300",
            cleanView
              ? "opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:border-primary hover:text-primary"
              : "hover:border-primary hover:text-primary",
          ].join(" ")}
        >
          {cleanView ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* ── NAV ────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-9 py-3 sm:py-5 z-50 pointer-events-none"
        style={{
          opacity: cleanView ? 0 : 1,
          pointerEvents: cleanView ? "none" : "auto",
          transition: "opacity 0.4s ease",
        }}
      >
        <div className="flex flex-col">
          <span className="text-lg sm:text-xl font-light tracking-[0.28em] uppercase">
            THE RADIAN
          </span>
          <span
            className="font-mono text-[0.42rem] tracking-[0.14em] uppercase text-muted-foreground"
            style={{ marginTop: "-1px", paddingLeft: "2px" }}
          >
            ver. 0.1
          </span>
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
              <ProfileMenu
                user={user}
                profile={profile}
                onVisitMoon={goToMyMoon}
                onEditProfile={() => setEditOpen(true)}
                onChangePassword={() => setChangePwOpen(true)}
                onSendFeedback={() => setFeedbackOpen(true)}
                onSignOut={handleSignOut}
              />
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
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-sm border border-border text-muted-foreground transition-all hover:border-primary hover:text-primary"
          >
            {theme === "dark" ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </nav>

      {/* ── BOTTOM HINT ─────────────────────────────────────────────── */}
      <div
        className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 font-mono text-[0.5rem] sm:text-[0.58rem] tracking-[0.2em] uppercase text-muted-foreground z-50 pointer-events-none whitespace-nowrap"
        style={{
          opacity: cleanView ? 0 : sceneView === "earth" ? (showHint ? 1 : 0) : 1,
          transition: "opacity 0.6s ease",
        }}
      >
        {sceneView === "earth"
          ? "Drag to explore · Click a log to view"
          : "Drag to rotate · Click a log to view"}
      </div>

      {/* ── LIVE COUNT ──────────────────────────────────────────────── */}
      <div
        className="fixed bottom-6 sm:bottom-8 right-4 sm:right-8 z-50 flex items-center gap-2 pointer-events-none"
        style={{ opacity: cleanView ? 0 : 1, transition: "opacity 0.4s ease" }}
      >
        <div
          className="w-[5px] h-[5px] bg-primary rounded-full"
          style={{ animation: "lp 2.5s ease-in-out infinite" }}
        />
        <span className="font-mono text-[0.48rem] sm:text-[0.56rem] tracking-[0.14em] uppercase text-muted-foreground hidden sm:inline">
          {activeCount} active now
        </span>
      </div>

      {/* ── STATUS ──────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-6 sm:bottom-8 left-4 sm:left-8 z-50 flex items-center gap-2 pointer-events-none"
        style={{ opacity: cleanView ? 0 : 1, transition: "opacity 0.4s ease" }}
      >
        <div className="flex flex-col gap-1">
          {profile?.username && (
            <div className="flex items-center gap-2">
              <div
                className="w-[5px] h-[5px] rounded-full bg-primary"
                style={{ animation: "lp 2.5s ease-in-out infinite" }}
              />
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

      {/* ── POST PANEL ──────────────────────────────────────────────── */}
      {!cleanView && (
        <PostPanel
          post={activePost}
          onClose={closeActivePost}
          onNext={sceneView === "earth" ? handleNextPost : undefined}
          onPrev={sceneView === "earth" ? handlePrevPost : undefined}
          onUserClick={handleUserClick}
        />
      )}

      {/* ── ORBITING MOON BUTTON ────────────────────────────────────── */}
      {user && profile?.username && !cleanView && (
        <div
          style={{
            opacity: sceneView === "earth" ? 1 : 0,
            pointerEvents: sceneView === "earth" ? "auto" : "none",
            transition: "opacity 0.4s ease",
          }}
        >
          <OrbitingMoon onClick={goToMyMoon} label={`@${profile.username}`} />
        </div>
      )}

      {/* ── AUTH MODAL ──────────────────────────────────────────────── */}
      <AuthModal
        open={authModal}
        onClose={() => setAuthModal(false)}
        initialTab={authTab}
      />

      {/* ── CREATE POST ─────────────────────────────────────────────── */}
      {user && (
        <CreatePostSheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          userId={user.id}
          onPostCreated={loadInitial}
        />
      )}

      {/* ── EDIT PROFILE MODAL ──────────────────────────────────────── */}
      {user && profile && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={profile}
          onSaved={() => {
            refreshMyProfile();
          }}
        />
      )}

      {/* ── CHANGE PASSWORD MODAL ───────────────────────────────────── */}
      {user && (
        <ChangePasswordModal
          open={changePwOpen}
          onClose={() => setChangePwOpen(false)}
          email={user.email ?? ""}
        />
      )}

      {/* ── FEEDBACK MODAL ──────────────────────────────────────────── */}
      {user && (
        <FeedbackModal
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          user={user}
          profile={profile}
        />
      )}

      {/* ── CLUSTER PANEL ───────────────────────────────────────────── */}
      {!cleanView && (
        <ClusterPanel
          posts={clusterPanelPosts}
          onClose={() => setClusterPanelPosts(null)}
          onPostClick={onPostClick}
        />
      )}

      {/* ── GLOBE TIMELINE ──────────────────────────────────────────── */}
      {sceneView === "earth" && !cleanView && (
        <GlobeTimeline
          rotationRef={globeRotationRef}
          rotateDeltaRef={globeRotateDeltaRef}
        />
      )}

      {/* ── LANDING OVERLAY ─────────────────────────────────────────── */}
      <LandingOverlay open={landingOpen} onEnter={dismissLanding} />
    </div>
  );
};

export default Index;
