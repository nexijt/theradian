# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:8080
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Run tests once (vitest)
npm run test:watch  # Watch mode
```

To run a single test file: `npx vitest run src/test/example.test.ts`

## Environment

Requires `.env` with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Architecture

**The Radian** is a social app where users "log" daily moments (photo or audio) pinned to geographic coordinates. Two main views:

- **`/` (Index)** — An interactive 3D globe (Three.js) showing all posts as dots. Clicking a dot opens a `PostPanel` on the right. Authenticated users can post via `CreatePostSheet`.
- **`/:username` (Profile)** — A personal "moon" scene (also Three.js) showing only that user's posts. URL format is `/@username`.

### Data flow

```
Supabase (posts + profiles tables)
  → src/lib/posts.ts (fetchPosts, createPost, etc.)
  → src/hooks/useFeed.ts (batched pagination, overlap spreading → FeedPost[])
  → Globe / Moon components (Three.js canvas + HTML overlays)
```

`FeedPost` (defined in `useFeed.ts`) is the universal display type used across globe, moon, and post panel components.

### Auth

`src/lib/auth.ts` handles sign-up/in/out and password reset. `useAuth` hook (`src/hooks/useAuth.ts`) wraps Supabase auth state. Sign-in accepts either email or username. Profile rows are in the `profiles` table, keyed by `user_id`.

### Supabase

Client is at `src/integrations/supabase/client.ts` — import as `import { supabase } from "@/integrations/supabase/client"`. The generated types file is `src/integrations/supabase/types.ts` (do not edit manually). Storage buckets: `photos` and `audio`.

### Tag system

Posts carry a `tag` field. Photo tags: `PHOTO`, `PIXEL`, `INK`, `MATTER`. Audio tags: `MUSIC`, `VOICE`, `SPOKEN`, `SOUND`. Use `getTagColor(tag, type)` and `normalizeTag(tag, type)` from `src/lib/tag-colors.ts` — these handle legacy tag names.

### Path alias

`@/` maps to `src/` throughout the codebase.

### UI

shadcn/ui components live in `src/components/ui/`. The theme (light/dark) is managed by `useTheme` and stored in `localStorage` under key `radian-theme`.

# Radian Refactor Guidelines

## Goals
- Clean up folder structure and file naming
- Extract reusable logic into shared utilities or hooks
- Remove dead code and unused imports
- Improve readability without over-engineering
- No tests needed at this stage

## Rules
- Do not change functionality, only structure
- Prefer small focused files over large ones
- Use consistent naming conventions throughout
- Do not add unnecessary abstraction
- After each prompt that results in files being changed, give a short descriptive commit message in the format "refactor/<commit_message>"
