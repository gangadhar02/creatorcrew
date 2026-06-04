# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The product is **CreatorCrew** (a creator content engine; older code/comments may say "Drafts" or "Saves Engine"). GitHub repo: `gangadhar02/creatorcrew`.

## Repository shape

Two halves that share one Supabase database:

- **Python sync** (repo root): `sync.py` pulls your Instagram *saved* posts via web-API cookies and upserts them into the Supabase `saves` table; `vision.py` runs Gemini multimodal analysis on media. The database (not a local state file) is the source of truth for dedup. `migrate_notion_to_supabase.py` is a one-off importer.
- **`webapp/`**: a Next.js 16 (App Router, RSC, Turbopack) app — serves BOTH the public **marketing landing** (`/`, `components/marketing/*`) and the **app** (Saves, Discover, Chat, Boards/Bookmarks canvases, Profile Analyzer, Voices, Settings). Split by hostname (see Domains below). Reads/writes the same Supabase.
- **`supabase/`**: `schema.sql` + numbered `migration_0NN_*.sql` files (currently through `migration_024`). **These are applied by hand in the Supabase SQL editor** — there is no migration runner. Code here cannot create policies/buckets/realtime; that's always a manual dashboard step. When you add a migration, the user must run it before code that depends on the new column/policy is deployed.
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
- **The landing page** (`/`) is ported from Lovable into `components/marketing/*`, scoped under a `.creatorcrew-landing` wrapper in `app/globals.css` (its own Drafts-palette tokens + Inter/Bricolage fonts) so it doesn't affect the app. It uses plain Tailwind + lucide (no Radix). Don't mix it with the app's base-ui components.
- **Canvases use tldraw v5, NOT React Flow.** Boards (`components/board/BoardCanvas.tsx`) and Bookmarks (`components/bookmarks/BookmarksTldrawCanvas.tsx`) both wrap the shared `components/tldraw/ServerTldrawCanvas.tsx`. Content tiles are a custom `content-tile` shape (`ContentTileShape.tsx`) referencing a DB row by id; the whole tldraw document persists as a JSON snapshot (`boards.canvas_state` / the `bookmark_canvas` table). **v5 gotcha:** the static `TLShape` union excludes custom shapes, so `BaseBoxShapeUtil<any>` + explicit method param types is used, with casts at the `editor` boundary. Pasting an IG link on a canvas ingests it via Apify (`onPasteUrl` → `lib/ingest/post-by-url.ts`).

## Architecture you can't see from one file

**Two separate Instagram-fetch worlds:**
1. *Personal saves* → `sync.py` only, using your real account cookies. Has no API alternative (Meta exposes no "saved posts" API).
2. *Everything else* (Profile Analyzer, Discover, creator ingest) → `webapp/lib/instagram*.ts` behind **`IG_FETCH_MODE`** = `apify | graph | cookie | auto`. **Apify is the chosen primary** (works on any public account, returns reel views); the cookie scraper keeps getting challenged. `lib/profile-analyzer.ts` picks the backend and falls back.

**Supabase access pattern:** server code uses the **service-role** client (`lib/supabase.ts` `getSupabase()`, bypasses RLS); browser uses the **anon** client (`lib/supabase-browser.ts`) and is RLS-gated. `getWorkspaceContext()` (`lib/workspace.ts`) resolves the per-user workspace from Supabase Auth on every request (returns `workspaceId`, `workspaceEmail`, `userId`). User profile fields live in auth `user_metadata` (incl. `plan`/`plan_status` from billing); client preferences live in `localStorage` (`lib/prefs.ts`). There is no separate `users`/`profiles`-for-auth table (the `profiles` table is the Profile Analyzer's IG-profile cache).

**Multi-tenancy — service-role bypasses RLS, so YOU must scope every query.** Because server reads use the service-role key, RLS does **not** protect them — every query must explicitly filter `.eq("workspace_id", ws.workspaceId)`. The "legacy" tables (`saves`, `content_ideas`, `sync_runs`, `profiles`, `profile_posts`) only got a `workspace_id` column in `migration_023`/`024`; **any new read/write of these MUST filter by workspace** or it leaks/overwrites other accounts' data. `profile_posts` is scoped via its (now per-workspace) `profile_id`. Workspace-native tables (`boards`, `creators`, `creator_posts`, `chats`, `bookmark_items`, `cards`, `documents`, `voices`, …) carry `workspace_id` + RLS already — still filter server-side. `sync.py` stamps `workspace_id` (resolved via `get_workspace_id`, env `SYNC_WORKSPACE_ID`/`SYNC_WORKSPACE_EMAIL`) onto saves + the `sync_runs` row.

**Dual-write:** the Profile Analyzer writes both `profile_posts` (its own table) and `creator_posts` (the unified discovery table) via `lib/dual-write.ts`. **`profile_posts.id` ≠ `creator_posts.id`** — they're mapped by `platform_pk`. Anything operating on a profile post that needs creator-post features (chat, add-to-board) must resolve the `creator_posts.id` first.

**Chat** (`/api/chat`): streams newline-delimited JSON events (`start | token | reasoning-delta | tool-call | complete | error`) consumed by `lib/chat-stream.ts`, rendered by `components/ChatThread.tsx`. Routes to Gemini or OpenRouter by model name (default is Gemini; `OPENROUTER_API_KEY` enables the OpenRouter path). Supports `@`-mentions (also on the home composer now), reasoning, image/PDF attachments (forced to a Gemini vision model), and on-demand transcript/vision tools for single-post `creator_post` chats (`lib/chat-post-tools.ts`). The "Chat"/"Boost" buttons go through `/api/boost`, which seeds a chat from a post and **must forward the request cookie** on its internal `fetch` to `/api/chat` (else workspace resolution 500s).

**Chat tools come in two kinds (`lib/tools.ts`) — generative UI:**
- *Render tools* — the model's call is terminal and surfaced as a **card** in `ChatThread`'s `ChatMessageView`: `showBoostVariations`, `draftDocument` (markdown document card), `showSocialPosts` (post-tile feed; the card fetches `GET /api/posts?ids=`), `creatorSnapshot` (metrics card). All wrap the shared `components/GenerativeCard.tsx` chrome (`DocumentCard` / `SocialPostsCard` / `CreatorAnalysisCard` / `VariationsCardList`).
- *Data tools* — names in `DATA_TOOL_NAMES` (`getCreatorData`, `analyzeCreatorPosts`). The route **executes these server-side in a tool-execution loop on the Gemini path** and feeds the result back so the model renders cards from real numbers (never invents them). `lib/creator-data.ts`: `getCreatorDataForChat` resolves the workspace creator (fuzzy handle/display-name match) + aggregates `creator_posts`; `analyzeCreatorPostsForChat` fetches each post's media **fresh via Apify** (`fetchPostByUrlApify` → `runGeminiOnMediaItem`, **cookie-free**), runs transcript + vision, caps at 3 posts, and caches results onto `creator_posts`. `runGeminiOnMedia` (cookie path, `lib/gemini-media.ts`) is still used by the single-post `chat-post-tools` flow but NOT by creator analysis.
- *Which tool to use* is steered by the Tool Routing block in `buildSystemPrompt` (`lib/chat-context.ts`): content / vision / transcript / idea requests MUST call `analyzeCreatorPosts` then a `draftDocument`; metrics-only requests call `getCreatorData` then `creatorSnapshot`. Keep that block tight when adding tools.

**Chat gotchas:**
- Tool calls are persisted ONLY in `chat_messages.tool_calls` and rendered from there. Do **not** embed them into `content_md` — args containing markdown ``` fences leak raw JSON. `lib/tool-text.ts` both strips legacy fenced `` ```tool:`` blocks out of history (so the model stops imitating them) and recovers a tool call the model accidentally emits as text.
- **Gemini 3 attaches a `thought_signature` to each `functionCall` part that must be echoed back verbatim** with its `functionResponse`, or the next turn 400s. The data-tool loop captures the raw parts (not `chunk.functionCalls`) to preserve it. AUTO function-calling also rejects `allowedFunctionNames` unless mode is `ANY`.
- The home composer hands its first prompt to the chat view via an in-memory handoff (`lib/pending-chat.ts`) so the answer streams in place instead of being dropped on navigation. Both composers carry autofill-ignore attrs (`data-1p-ignore`, `data-lpignore`, `autoComplete="off"`) to avoid a form-filler-extension `setState` loop ("Maximum update depth").

**Background-job dispatch:** `/api/profiles/analyze` and `/api/sync` either run inline (local dev) or **dispatch a GitHub Actions workflow** when a dispatch token is set (`ANALYZER_DISPATCH_TOKEN` / `SYNC_DISPATCH_TOKEN` — a GitHub PAT with Actions write, set in Vercel). The `sync.yml` cron is intentionally disabled (IG cookie challenge); only the on-demand trigger is wired. `sync.py` writes `sync_runs` rows (`running` → `completed`) for progress. `GITHUB_REPO_NAME` defaults to `creatorcrew`.

**Domains & hostname routing (`proxy.ts`):** one Vercel project serves two domains, routed by `Host` header — `creatorcrew.app` = **marketing landing only** (`/`), `studio.creatorcrew.app` = **the app** (`/home`, `/bookmarks`, …). On the bare domain the proxy 308-redirects every non-`/` path to `studio.`; `www.`→apex, `app.`→`studio.`. **localhost + `*.vercel.app` previews keep "combined" mode** (landing at `/`, app at `/home`) so dev/preview work without subdomains. The app home is `app/home/page.tsx` (NOT `/`). Auth cookie is scoped to `.creatorcrew.app` in prod (shared across subdomains). Configurable via `NEXT_PUBLIC_ROOT_DOMAIN`. Auth lives on `studio.` → Supabase Site URL + redirect URLs point there.

**Payments (Dodo):** the pricing CTAs link to `/subscribe?plan=creator|pro` — an **auth-gated** route (`app/subscribe/route.ts`), so picking a plan forces signup first, then redirects to the Dodo hosted checkout (`lib/billing.ts` holds the product ids) with the user's email + `metadata_user_id`. `/api/webhooks/dodo` verifies the Standard-Webhooks signature (via the `standardwebhooks` lib; env `DODO_PAYMENTS_WEBHOOK_KEY`) and writes `{ plan, plan_status }` to the user's `user_metadata`, mapping by `metadata.user_id` → customer email. Feature-gating per plan is not yet enforced (the plan is just stored). Auth emails are sent via Resend custom SMTP (Supabase → Auth → SMTP).

## Environment

- Python: `config.json` (gitignored; IG cookies, Gemini key) + root `.env` (Supabase).
- Webapp: `webapp/.env.local` (gitignored). Key vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `IG_FETCH_MODE`, `APIFY_API_TOKEN`, `IG_SCRAPE_*` (cookie fallback), `SYNC_DISPATCH_TOKEN` / `ANALYZER_DISPATCH_TOKEN`, optional `OPENROUTER_API_KEY`. Prod also: `NEXT_PUBLIC_ROOT_DOMAIN` (=`creatorcrew.app`), `DODO_PAYMENTS_WEBHOOK_KEY`, `GITHUB_REPO_NAME`.
- Production secrets live in **Vercel** (webapp) and **GitHub Actions repo secrets** (the workflows). Adding a backend that runs in CI means setting the secret in *both* the Actions secrets and Vercel.
- **Dev tooling:** `.agents/`, `.claude/skills/`, `skills-lock.json` are local harness artifacts (gitignored). (The `agentation` dev annotation widget + its MCP were removed.)
