import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit2 } from "lucide-react";
import Moon from "@/components/Moon";
import PostPanel from "@/components/PostPanel";
import EditProfileModal from "@/components/EditProfileModal";
import { useAuth } from "@/hooks/useAuth";
import { useProfileByUsername, useMyProfile } from "@/hooks/useProfile";
import { fetchPostsByUserId } from "@/lib/posts";
import { type FeedPost, postToFeedPost } from "@/hooks/useFeed";

const profileTimeFormat = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const Profile = () => {
  // Route is /:username — URL is /@nexijt, param captures "@nexijt", strip the @
  const { username: rawParam } = useParams<{ username: string }>();
  const username = rawParam?.startsWith("@") ? rawParam.slice(1) : rawParam;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile: myProfile, refresh: refreshMyProfile } = useMyProfile(user);
  const { profile, loading, notFound } = useProfileByUsername(username);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  // Trigger entrance animation after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const isMe = useMemo(
    () => !!user && !!profile && profile.user_id === user.id,
    [user, profile]
  );

  useEffect(() => {
    if (!profile) return;
    setPostsLoading(true);
    fetchPostsByUserId(profile.user_id)
      .then((rows) => setPosts(rows.map(p => postToFeedPost(p, profileTimeFormat(p.created_at), "Somewhere on Earth"))))
      .finally(() => setPostsLoading(false));
  }, [profile]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <span className="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-muted-foreground">
          Loading…
        </span>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-3xl font-light italic text-foreground">Moon not found</h1>
        <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-muted-foreground">
          @{username} doesn't exist
        </p>
        <Link
          to="/"
          className="font-mono text-[0.6rem] tracking-[0.18em] uppercase px-5 py-2 rounded-sm border border-border hover:border-primary hover:text-primary transition-all"
        >
          ← Back to globe
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{
        transformOrigin: "bottom right",
        transform: entered ? "scale(1)" : "scale(0.92)",
        opacity: entered ? 1 : 0,
        transition: "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease",
      }}
    >
      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-9 py-3 sm:py-5 z-50">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 font-mono text-[0.55rem] sm:text-[0.62rem] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to globe
        </button>
        <div className="font-mono text-[0.55rem] sm:text-[0.62rem] tracking-[0.22em] uppercase text-muted-foreground">
          {isMe ? "your moon" : `${displayName}'s moon`}
        </div>
      </nav>

      {/* Moon scene — fills entire screen */}
      <div className="absolute inset-0">
        <Moon posts={posts} onPostClick={setSelectedPost} />
      </div>

      {/* Profile card (left) */}
      <div
        className="fixed top-1/2 left-4 sm:left-8 -translate-y-1/2 z-40 w-[260px] max-w-[80vw] p-6 rounded-sm border border-border"
        style={{
          background: "hsl(var(--popover) / 0.85)",
          backdropFilter: "blur(10px)",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateX(0)" : "translateX(-16px)",
          transition: "opacity 0.5s ease 0.25s, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s",
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-light italic text-muted-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-light italic truncate text-foreground">{displayName}</div>
            <div className="font-mono text-[0.55rem] tracking-[0.14em] uppercase text-muted-foreground truncate">
              @{profile.username}
            </div>
          </div>
        </div>

        {profile.bio && (
          <p className="font-serif text-sm text-foreground/80 leading-relaxed mb-4 italic">
            {profile.bio}
          </p>
        )}

        <div className="font-mono text-[0.55rem] tracking-[0.14em] uppercase text-muted-foreground mb-4">
          {postsLoading ? "…" : `${posts.length} ${posts.length === 1 ? "log" : "logs"}`}
        </div>

        {isMe && (
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 font-mono text-[0.55rem] tracking-[0.14em] uppercase px-3 py-1.5 rounded-sm border border-border hover:border-primary hover:text-primary transition-all"
          >
            <Edit2 className="w-3 h-3" />
            Edit moon
          </button>
        )}
      </div>

      {/* Post panel */}
      <PostPanel post={selectedPost} onClose={() => setSelectedPost(null)} />

      {/* Edit modal (only for own profile) */}
      {isMe && myProfile && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={myProfile}
          onSaved={() => { refreshMyProfile(); }}
        />
      )}

      {/* Hint */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 font-mono text-[0.5rem] sm:text-[0.55rem] tracking-[0.2em] uppercase text-muted-foreground z-40 pointer-events-none whitespace-nowrap">
        Drag to rotate · Click a log to view
      </div>
    </div>
  );
};

export default Profile;
