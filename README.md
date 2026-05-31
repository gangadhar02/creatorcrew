# drafts

A personal content workflow built on top of your Instagram **saved** posts. It pulls everything you've saved into a Supabase database, enriches it with Gemini multimodal analysis, and surfaces it through a Next.js web app for browsing, discovery, ideation, and AI-assisted drafting.

## Overview

The project has two halves that share a single Supabase database:

- **Python sync** (repo root) — pulls your Instagram saved posts and runs vision analysis on the media.
- **Web app** (`webapp/`) — a Next.js 16 app that reads/writes the same database and provides the entire UI: Saves, Discover, Chat, Boards, Profile Analyzer, Voices, and Settings.

The database is the source of truth (including for deduplication) — there is no local state file.

## Repository layout

```
.
├── sync.py                        # Pull IG saved posts → Supabase `saves` table
├── vision.py                      # Gemini multimodal analysis of saved media
├── migrate_notion_to_supabase.py  # One-off Notion → Supabase importer
├── requirements.txt               # Python dependencies
├── config.example.json            # Template for sync config (IG cookies + Gemini)
├── supabase/                      # schema.sql + numbered migration_0NN_*.sql files
├── webapp/                        # Next.js 16 app (App Router, RSC, Turbopack)
└── .github/workflows/             # sync.yml + analyze-profile.yml (heavy jobs run in CI)
```

## Architecture

**Two separate Instagram-fetch worlds:**

1. **Personal saves** → handled by `sync.py` only, using your real account cookies. Meta exposes no API for saved posts, so this is the only path.
2. **Everything else** (Profile Analyzer, Discover, creator ingest) → `webapp/lib/instagram*.ts`, behind an `IG_FETCH_MODE` switch (`apify | graph | cookie | auto`). Apify is the primary backend; the others act as fallbacks.

**Supabase access:** server code uses the service-role client (bypasses RLS); the browser uses the anon client (RLS-gated). User profile fields live in Supabase Auth `user_metadata`; client preferences live in `localStorage`.

**Background jobs:** Vercel can't run Python or reach Instagram, so long-running jobs (`sync`, profile analysis) are dispatched to GitHub Actions workflows when a dispatch token is configured.

## Getting started

### Python sync

```bash
pip install -r requirements.txt
cp config.example.json config.json   # then fill in IG cookies + Gemini key
# create a root .env with your Supabase URL + service key
python sync.py
```

`config.json` (gitignored) holds your Instagram cookies and Gemini key; the root `.env` holds Supabase credentials.

### Web app

```bash
cd webapp
npm install
npm run dev      # dev server on http://localhost:3000 (Turbopack)
```

Other useful scripts:

```bash
npm run build                       # production build (fast; use to validate)
npm run lint                        # ESLint
npx tsc --noEmit -p tsconfig.json   # typecheck
```

Create `webapp/.env.local` with the required vars — key ones include `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `IG_FETCH_MODE`, and `APIFY_API_TOKEN`.

## Database

SQL lives in `supabase/`: `schema.sql` plus numbered `migration_0NN_*.sql` files. These are applied **by hand in the Supabase SQL editor** — there is no migration runner. Policies, storage buckets, and realtime configuration are manual dashboard steps.

## Tech stack

- **Backend sync:** Python (`requests`, `supabase`, `google-genai`)
- **Web app:** Next.js 16 (App Router, React Server Components, Turbopack), React 19, TypeScript
- **UI:** shadcn on `@base-ui/react`, Tailwind CSS v4, `lucide-react`, `framer-motion`, `sonner`
- **AI:** Google Gemini (multimodal + chat), optional OpenRouter for chat models
- **Data:** Supabase (Postgres + Auth + Storage + realtime, with pgvector for discovery)
- **CI:** GitHub Actions for sync and profile-analysis jobs

## Notes

- This app is built for a single user's workflow — there is no multi-tenant `users`/`profiles` table.
- There is no automated test suite; `npm run build` and `tsc --noEmit` are the fastest correctness signals for the web app.
- See [`CLAUDE.md`](./CLAUDE.md) and `webapp/AGENTS.md` for deeper architectural conventions.
