# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Two halves that share one Supabase database:

- **Python sync** (repo root): `sync.py` pulls your Instagram *saved* posts via web-API cookies and upserts them into the Supabase `saves` table; `vision.py` runs Gemini multimodal analysis on media. The database (not a local state file) is the source of truth for dedup. `migrate_notion_to_supabase.py` is a one-off importer.
- **`webapp/`**: a Next.js 16 (App Router, RSC, Turbopack) app — the entire UI: Saves, Discover, Chat, Boards, Profile Analyzer, Voices, Settings. Reads/writes the same Supabase.
- **`supabase/`**: `schema.sql` + numbered `migration_0NN_*.sql` files. **These are applied by hand in the Supabase SQL editor** — there is no migration runner. Code here cannot create policies/buckets/realtime; that's always a manual dashboard step.
- **`.github/workflows/`**: `sync.yml` (runs `sync.py` in CI) and `analyze-profile.yml` (runs the Profile Analyzer in CI) — production can't run Python or hit Instagram from Vercel IPs, so heavy/long jobs are dispatched to GitHub Actions.

## Commands

Webapp (`cd webapp` first):
- `npm run dev` — Next dev server on **port 3000** (Turbopack).
- `npm run build` — production build (use this to validate before shipping; it's fast).
- `npm run lint` — ESLint.
- `npx tsc --noEmit -p tsconfig.json` — typecheck. **Run this after every change**; it's the fastest correctness signal.
- There is **no test suite**.

Python (repo root):
- `pip install -r requirements.txt`
- `python sync.py` — needs `config.json` (IG cookies + Gemini; see `config.example.json`) and `.env` (Supabase URL + service key).

## Webapp conventions (critical — also see `webapp/AGENTS.md`)

- **This is Next.js 16 with breaking changes vs. training data.** Read `webapp/node_modules/next/dist/docs/` before writing non-trivial Next code.
- **UI is shadcn on `@base-ui/react` (`style: "base-nova"`), NOT Radix.** Don't import Radix directly. Base UI APIs differ: triggers use a `render` prop (not `asChild`), tooltips/menus use `delay`, etc. Discover components via the shadcn MCP rather than guessing names.
  - Gotcha seen in practice: base-ui `MenuGroupLabel` throws outside a `<Menu.Group>`; `DialogContent` has a built-in close button (`showCloseButton`); its default width is `sm:max-w-sm` so override with `sm:max-w-...`.
- **AI Elements** (`components/ai-elements/*`) is installed for the chat UI and uses `streamdown` for markdown. Patched in a few spots for base-ui compatibility.
- Use `lucide-react` icons, `framer-motion`, `sonner` `toast()`. Modify CSS vars in `app/globals.css` to rebrand — don't add new palettes.

## Architecture you can't see from one file

**Two separate Instagram-fetch worlds:**
1. *Personal saves* → `sync.py` only, using your real account cookies. Has no API alternative (Meta exposes no "saved posts" API).
2. *Everything else* (Profile Analyzer, Discover, creator ingest) → `webapp/lib/instagram*.ts` behind **`IG_FETCH_MODE`** = `apify | graph | cookie | auto`. **Apify is the chosen primary** (works on any public account, returns reel views); the cookie scraper keeps getting challenged. `lib/profile-analyzer.ts` picks the backend and falls back.

**Supabase access pattern:** server code uses the **service-role** client (`lib/supabase.ts` `getSupabase()`, bypasses RLS); browser uses the **anon** client (`lib/supabase-browser.ts`) and is RLS-gated. `getWorkspaceContext()` (`lib/workspace.ts`) resolves the single per-user workspace from Supabase Auth on every request. There is **no `users`/`profiles` table** — user profile fields live in auth `user_metadata`; client preferences live in `localStorage` (`lib/prefs.ts`).

**Dual-write:** the Profile Analyzer writes both `profile_posts` (its own table) and `creator_posts` (the unified discovery table) via `lib/dual-write.ts`. **`profile_posts.id` ≠ `creator_posts.id`** — they're mapped by `platform_pk`. Anything operating on a profile post that needs creator-post features (chat, add-to-board) must resolve the `creator_posts.id` first.

**Chat** (`/api/chat`): streams newline-delimited JSON events (`start | token | reasoning-delta | tool-call | complete | error`) consumed by `lib/chat-stream.ts`. Routes to Gemini or OpenRouter by model name. Supports: `@`-mentions, reasoning, the `showBoostVariations` tool (rendered as cards), image/PDF attachments (forced to a Gemini vision model), and on-demand transcript/vision tools for post-context chats (`lib/chat-post-tools.ts`). The "Chat"/"Boost" buttons go through `/api/boost`, which seeds a chat from a post and **must forward the request cookie** on its internal `fetch` to `/api/chat` (else workspace resolution 500s).

**Background-job dispatch:** `/api/profiles/analyze` and `/api/sync` either run inline (local dev) or **dispatch a GitHub Actions workflow** when a dispatch token is set (`ANALYZER_DISPATCH_TOKEN` / `SYNC_DISPATCH_TOKEN` — a GitHub PAT with Actions write, set in Vercel). The `sync.yml` cron is intentionally disabled (IG cookie challenge); only the on-demand trigger is wired. `sync.py` writes `sync_runs` rows (`running` → `completed`) for progress.

## Environment

- Python: `config.json` (gitignored; IG cookies, Gemini key) + root `.env` (Supabase).
- Webapp: `webapp/.env.local` (gitignored). Key vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `IG_FETCH_MODE`, `APIFY_API_TOKEN`, `IG_SCRAPE_*` (cookie fallback), `SYNC_DISPATCH_TOKEN` / `ANALYZER_DISPATCH_TOKEN`, optional `OPENROUTER_API_KEY`.
- Production secrets live in **Vercel** (webapp) and **GitHub Actions repo secrets** (the workflows). Adding a backend that runs in CI means setting the secret in *both* the Actions secrets and Vercel.
