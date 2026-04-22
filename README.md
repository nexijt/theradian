# The Radian

A social logging app for hobbyists where users pin daily moments — photo or audio — to exact coordinates on an interactive 3D globe. Every post is a point in space and time.

![Globe view](https://raw.githubusercontent.com/nexijt/theradian/main/public/og-preview.png)

---

## What it is

The Radian gives each user two views of the world:

- **Globe** — a shared 3D Earth showing every post from every user as an animated dot with a trailing line. Drag to rotate, click any dot to open the post.
- **Moon** — a personal 3D sphere showing only your own posts. Accessible from your profile, styled as a private archive of logged moments.

Each user can post once per day per type (photo or audio). Posts are pinned to the user's real geographic location via the browser geolocation API, with city and country resolved through reverse geocoding.

---

## Technologies

| Layer | Stack |
|---|---|
| Framework | React 18 + TypeScript |
| 3D rendering | Three.js (custom WebGL scenes, Line2 thick lines) |
| Backend & auth | Supabase (PostgreSQL, Auth, Storage) |
| Styling | Tailwind CSS + shadcn/ui |
| Build | Vite |
| Routing | React Router v6 |

---

## Features

- **Interactive 3D globe** with animated post dots, continent outlines, and curved country/ocean labels that fade in as they rotate into view
- **Personal moon scene** per user — a private 3D sphere with crater detail and all your logged moments
- **One post per day** limit, enforced per type (photo and audio are tracked separately)
- **Photo posts** — uploaded, cropped to square, and compressed client-side before storage
- **Audio posts** — .mp3 / .wav, trimmed to 60 seconds client-side before upload
- **Tag system** — photos tagged as `PHOTO`, `PIXEL`, `INK`, or `MATTER`; audio tagged as `MUSIC`, `VOICE`, `SPOKEN`, or `SOUND`, each with a distinct colour on the globe
- **Geographic pinning** — browser geolocation + reverse geocoding to city/country level
- **Real-time presence** — live count of users currently on the globe via Supabase Realtime
- **Light / dark theme** — persisted to localStorage
- **Editable profile** — display name, bio, avatar

---

## Auth

- Sign up with **email, username, and password**
- Sign in with **email or username**
- **Email verification** on registration
- **Password reset** via email link
- Usernames are 3–20 characters, letters / numbers / underscore, case-insensitive

---

## Running locally

**Prerequisites:** Node.js 18+, a free [Supabase](https://supabase.com) project

```bash
# 1. Clone
git clone https://github.com/nexijt/theradian.git
cd theradian

# 2. Install dependencies
npm install

# 3. Add environment variables
cp .env.example .env
# Fill in your Supabase project URL and anon key:
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# 4. Start the dev server
npm run dev
# → http://localhost:8080
```
