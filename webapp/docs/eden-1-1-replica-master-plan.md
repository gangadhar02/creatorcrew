# Eden 1:1 Replica — Master Plan

## Context

This is the plan to take **CreatorCrew** (our IG Saves → ideation app at `webapp/` running on `localhost:3000`) from its current state — a working Eden-inspired clone with 12 phases shipped — to a **1:1 visual + behavioral replica of [app.eden.so](https://app.eden.so)**, minus billing/monetization.

Why now: over this session we (a) finished the original 12-phase Eden-inspired pivot, (b) reverse-engineered Eden in depth via Claude in Chrome MCP — backend topology, every endpoint, the LLM stack, all boost system prompts, the post enrichment schema, the outlier-scoring math, every UI screen — and (c) realized that what we built is ~60% of Eden's product. The remaining 40% is captured in this plan.

Three companion docs already exist with the raw extracts; this plan inlines the *strategic* details:
- [`webapp/docs/eden-architecture.md`](../../../Personal/Instagram%20Saves%20Engine/webapp/docs/eden-architecture.md) — backend topology, microservices, tech stack
- [`webapp/docs/eden-deep-dive.md`](../../../Personal/Instagram%20Saves%20Engine/webapp/docs/eden-deep-dive.md) — every endpoint, full schemas, all extracted prompts
- [`webapp/docs/eden-ui-replica-plan.md`](../../../Personal/Instagram%20Saves%20Engine/webapp/docs/eden-ui-replica-plan.md) — 19 screens with ASCII layouts + gap analysis

Outcome: After ~7 focused weeks, CreatorCrew should be indistinguishable from Eden to a side-by-side viewer (with our own creator catalog and no billing).

---

## What's already shipped (don't redo)

### Phases 1-12 (the original Eden-inspired pivot — DONE)
- **Phase 1-3:** Supabase schema (`creator_posts`, `creators`, `saves`, `content_ideas`, etc.), sync.py IG ingestion with cookie auth, vision.py for Gemini analysis, Next.js webapp scaffold, saves list/detail views, TipTap markdown editor
- **Phase 4-4.5:** Profile analyzer, workspaces + onboarding (`workspaces`, `onboarding_progress` migrations), Eden-style sidebar (Home/Discover/Chat top nav + Workspace boards + Today chats + Tools), ⌘K command palette, workspace switcher, home dashboard with rotating headlines + 4-item checklist
- **Phase 5:** Voice / Intellectual Signature (`voices` migration with 6 archetypes, voice library at `/voice`, voice picker)
- **Phase 6:** Cross-platform unification (`creator_posts` is single source of truth, compat views for old `saves` + `profile_posts`)
- **Phase 7:** Discover feed at `/discover` with pillar chips, filters, post-seen tracking, BoostMenu, SaveToBoardMenu
- **Phase 8:** Creators + Lists (`creator_lists` + `creator_list_members`, /creators/[platform]/[handle] detail page)
- **Phase 9:** Boards + Cards + Documents + Files (`boards`, `cards`, `documents`, `files`, `board_items` polymorphic — but currently a GRID, not infinite canvas)
- **Phase 10:** Universal Chat + Boost (`chats` + `chat_messages` polymorphic, SSE streaming via ndjson, 5 boost starters in `lib/boost-starters.ts`)
- **Phase 11:** Multi-pane workspace (`/workspace?panes=...`, `PaneShell.tsx`, `PaneFrame.tsx`, 4 pane content components, ⌥1/2/3/W shortcuts)
- **Phase 12:** YouTube (Data API v3) + Substack (RSS) ingestion via `lib/ingest/youtube.ts`, `lib/ingest/substack.ts`, unified `/api/ingest/[platform]` dispatcher

### shadcn migration (DONE)
- shadcn/ui (Base UI variant `base-nova`) initialized — 17 primitives in `components/ui/`
- 488 `var(--accent)`/`var(--muted)` references migrated to `var(--primary)`/`var(--muted-foreground)` via bulk sed
- lucide-react, framer-motion, sonner installed
- Refactored: `Sidebar.tsx`, `PostCard.tsx`, `CommandPalette.tsx`, `MentionAutocomplete.tsx`, `ChatThread.tsx`, `NewChatHome.tsx`, `app/page.tsx`
- Animations: page fade-in, `card-hover` class, motion-driven message bubble entry, mention popover scale-fade
- Loading skeletons: `discover`, `boards`, `chat`, `workspace`
- Tooltip provider + Sonner toaster wired in `app/layout.tsx`, auto-dark-mode via pre-hydration script
- `next.config.ts` has `optimizePackageImports: ['lucide-react', 'framer-motion', 'sonner']`
- shadcn MCP installed at `webapp/.mcp.json` for future discovery

### Doc artifacts in `webapp/docs/`
- `eden-architecture.md` (16 KB) — first-pass architecture overview
- `eden-deep-dive.md` (26 KB) — every endpoint, every schema, every extracted prompt, 30-day execution sketch
- `eden-ui-replica-plan.md` (28 KB) — 19 screens with ASCII layouts + gap analysis + 4-phase plan

---

## What Eden actually is (the spec we're cloning)

### Backend topology — 5 microservices

| Subdomain | What it does |
|---|---|
| `app.eden.so` | Vite + React SPA, single bundle (no Next.js) |
| `search.eden.so` | Tantivy-backed sync engine (manifest/snapshot/blob) + Typesense hybrid search for Discover |
| `social.eden.so` | Creators, posts, lists, pillars, hide-seen, interaction events |
| `ai.eden.so` | LLM chat + boost + voice + credit metering |
| `public.eden.so` | CDN mirror for social media thumbnails + avatars (content-hashed) |

(We're skipping `billing.eden.so` — no monetization in our build.)

### LLM stack
- **OpenRouter → `deepseek/deepseek-v4-pro`** (~1/10th of Claude Sonnet cost)
- `mode: "regular" | "max"` toggle (Pro plan unlocks max-mode)
- **Reasoning streamed separately** from final output: `reasoning-start`, `reasoning-delta`, then `text-delta` — UI's "Thoughts" collapsible maps to reasoning events
- System prompts sent FROM THE CLIENT (we extracted all 10 from their JS bundle)

### Data layer
- **InstantDB** for relational data with real-time sync (we'll use Supabase instead)
- **Tantivy** for per-workspace search index (server-built, binary shipped to client) — we'll use Postgres full-text or skip for our scale
- **Typesense** for cross-platform Discover (hybrid keyword + vector, `searchPath: typesense-hybrid` for open feed, `typesense-recency` for pillar-filtered)
- **Two-stage relaxation pipeline**: `strict` → `outlier-gte-5` fallback if not enough hits

### Outlier scoring — generalized Pareto tail
Per-creator, per-segment (reel/post/default), per-metric (views/likes), 30-post window:
```yaml
outlierBaselines: [
  { tau: 0.25,   median: 64551, mInfinity: 197254, segmentId: "reel",    metricLabel: "views" },
  { tau: 0.25,   median: 361,   mInfinity: 571,    segmentId: "post",    metricLabel: "likes" },
  { tau: 0.417,  median: 694,   mInfinity: 1979,   segmentId: "default", metricLabel: "likes" }  # Twitter
]
```
- `tau` = threshold quantile (top X% considered outliers)
- `median` + `mInfinity` parameterize the tail fit
- Per-platform `tau` tuning: IG `0.25`, Twitter `0.417`
- Display "typical X" = the `median` value

### Pillar taxonomy — `ext:tier1__tier2__tier3`
Hierarchical with external-taxonomy prefix:
```
ext:productivity__automation__ai_agents  →  "Productivity › Automation › AI agents"
```
Top-level pillars: **Productivity, Self-improvement, Business, Health & fitness, Content creation, Psychology**.

Pinning a pillar **auto-creates a `kind:"adaptive"` "For you" list** (✨ emoji, position -1000).

### Post enrichment (the killer feature)
Every post pre-computed on ingest:
```ts
enrichment: {
  taxonomyId, taxonomyLabel, taxonomyTier1,
  contentTypeLabel,      // "tutorial" | "explainer" | "story" | "promo" | …
  mediaFormat,           // "short_video" | "long_video" | "image" | "carousel" | "article"
  mood,                  // "educational" | "motivational" | …
  aiTags: string[],      // 5-10 free-text tags
  aiDescription,         // 2-3 sentence summary
  aiOverview: {          // ← PRE-COMPUTED BOOST ANALYSIS
    blocks: [
      { type: "hook", mechanic: "curiosity gap",
        openingLine: "Why would you subscribe to Claude, only to use 10% of its brain?",
        why: "It prompts the audience to question their current usage of AI…",
        tone: "accent" },
      { type: "pullQuotes", items: ["<quote 1>", "<quote 2>"] },
      // …more block types: format, structure, devices, etc.
    ]
  },
  enrichedAt, aiOverviewGeneratedAt
}
```
This is what makes Eden's Boost feel instant — the analysis is already done, the LLM riffs on cached data.

### Interaction-event personalization
- `POST /events/content` batches 18+ events per call (`view`, `dwell`, `impression`, `click`, `save`, `boost`)
- Each event has `dwellMs`, `surface`, `position`, `metadata`
- Personalization kicks in at **8+ signals** — builds a user-profile vector, runs ANN merge into Typesense results
- `personalization.eligible`, `signalWeight`, `annPoolSize`, `annPoolMerged`, `threshold: 8`

### Social-mirror CDN
- IG/YT/X/etc thumbnails downloaded server-side, re-hosted at `public.eden.so/social-mirror/<platform>/<pk>/thumbnail.jpg`
- Avatars content-hashed: `…/profiles/<userId>/avatar-<sha256>.jpg`
- Eliminates URL-expiry hell + adblocker false-positives
- `mediaMirror.thumbnail.bytes` stored for storage budgeting

### Frontend internals (naming we discovered)
- "canvas" = board (infinite-pan/zoom canvas, NOT grid)
- "space" = the board container
- "element" = item inside a board
- `localStorage[canvas-camera-cache:v1:<ws>:<spaceId>]` = `{position:{x,y}, zoom, updatedAt}` — pan/zoom persisted
- Headlines rotate randomly (we've seen 7+ variants)

### Tech stack vendors
- Vite + React SPA · InstantDB · Tantivy · Typesense · OpenRouter+DeepSeek · Orb billing · self-hosted PostHog (`obs.eden.so`) · Loops.so · FirstPromoter · Discord OAuth · Stripe alongside Orb

### The C8 conversation protocol
Appended to every boost system prompt. Forces "ask first, perform second":
> **"Your first reply MUST be a single short message that asks the user for the input you need to do your job. Do not start the analysis on the first turn. In that first reply, briefly remind the user how they can give you input inside Eden: type or paste the text directly, `@` mention any board item, drop in a link, transcript, or quote. Keep the first reply tight. 2 to 4 sentences max, conversational tone, no headings. Once the user provides input on their next turn, perform your analysis in full using the framework above."**

### The 10 boost prompts (full extracts in `eden-deep-dive.md`)

**5 chat-tab boosts** (visible on `/chat` new-chat home):
1. **Content Breakdown** (`content-breakdown`) — "You are a content analyst who reverse-engineers what makes great writing work…"
2. **Thinking Partner** (`thinking-partner`) — "You are a rigorous thinking partner… Channel the intellectual DNA of: Paul Graham's first-principles directness, Naval Ravikant's mental models, Daniel Schmachtenberger's systems-level analysis, Ken Wilber…"
3. **Start Writing** (`start-writing`) — "You are a writing strategist who helps creators get from wherever they are to a piece they can publish today…"
4. **Build a voice** (`find-your-voice`, `usesVoiceProfile: false`) — "You are a Perspective Architect. You help creators discover their intellectual signature…"
5. **Grade My Content** (`grade-my-content`) — "You are a no-bullshit editor with craft… Treat the user like a peer who came for the truth — encouragement is for friends. Every line earns its place, every transition holds energy, the hook never coasts."
6. **Niche Playbook** (`find-viral-ideas`) — "You are a viral-content scout for creators… Every claim is grounded in specific posts: who made it, what platform, what numbers (views, likes, outlier multiple)…"

**6 post-level boosts** (⚡ menu on a post — different from chat-tab):
1. **Variations** (`variations` / "Discover Remix Boost mode") — calls `showBoostVariations` tool with 3-5 variants. Critical rule: **"No em dashes or en dashes anywhere"** (that's the AI-text tell). Uses voice profile's `vocabulary`, `anchorStory`, `writingSample`.
2. **Expand to Longform** (`expand-longform`)
3. **Reverse Engineer** (`reverse-engineer`) — **same prompt as chat-tab Content Breakdown** (different entry)
4. **Replicate** (`replicate`) — "Use the structure yourself"
5. **Headline Variations** (`headline-variations`) — conditional (long-video only) — "Brainstorm titles for your niche"
6. **Break into Post Ideas** (`break-into-post-ideas`) — conditional (long-form)

Each post boost auto-generates a markdown user message:
```
> ### Remix this post
> - **Author:** [Greg Isenberg (@gregisenberg)](https://www.instagram.com/gregisenberg/)
> - **Platform:** instagram · **Format:** video
> - **Link:** [instagram.com](https://www.instagram.com/reel/DWcIFs7EVIh/)
> - **Post:** <caption>
> - **Transcript:** <transcript>
```

### Voice profile schema (lives on `users.voiceProfile`, JSON)
```ts
{
  personality:      string,
  audience:         string,
  anchorStories:    string[],
  formatScaffolds:  string[],
  toneTags:         string[],
  rhythm:           string,
  formatHabits:     string,
  prefer:           string[],
  avoid:            string[],
  notes:            string,
  vocabulary:       string[],    // distinctive phrases
  writingSamples:   string[],
  version:          "v0" | "v1" | "v1.1" | …
}
```

With **carry-forward rule**: every save preserves prior fields verbatim, only adds/changes what new material warrants. Voice Builder ships a v0 card early after 2-3 turns, refines to v1.

---

## Strategic goal

**1:1 replica of Eden, minus billing.** Same screens, same UX, same prompts, same boost flow, same personalization model. Our Supabase + Next.js + Gemini/OpenRouter under the hood.

What this is NOT:
- Not a fork. Different infra (Supabase not InstantDB, Postgres FTS or Typesense not Tantivy).
- Not a SaaS for sale. Personal-scale tool — single workspace, no auth gymnastics, no Stripe.

---

## The 7-week execution plan

### PHASE A — Visual polish (Week 1)

Goal: CreatorCrew looks like Eden in screenshots. No new backend work. Each task ≤1 day.

#### A.1 — Sidebar polish (½ day)
Files: `webapp/components/Sidebar.tsx`, `webapp/components/WorkspaceSwitcher.tsx`

Changes:
- Workspace switcher (footer) — add real dropdown with **Settings · Billing · Sign out** rows (Billing → no-op stub, Settings → `/settings` placeholder, Sign out → confirm + reset cookies)
- Confirm exact section order: ⌘K pill → Top nav (Home/Discover/Chat/Workspace) → Today (recent chats) → Workspace (boards) → Tools (legacy: Saves/Ideate/Ideas/Profiles) → footer
- Use lucide icons throughout (we have most; verify `Columns3` for Workspace, `Home`, `Compass`, `MessageCircle`)

#### A.2 — Home dashboard polish (½ day)
Files: `webapp/app/page.tsx`

Changes:
- Add `"What's on your mind?"` and `"Welcome back."` to the headlines pool in `HEADLINES` (currently 5 entries, add to make 7)
- "My lists" section: filter pills should be `(All Following N)` `(<List Name> N)` matching Eden exactly
- 4 sort tabs below: Recent, Top liked, Top viewed, Top outlier — wire to existing `home-following-filter:v1` localStorage shape
- Platform dropdown on this page (currently we have it only on Discover)
- Match Eden's "Getting started" exact copy verbatim (we're mostly there)

#### A.3 — Discover filter consolidation (1 day)
Files: `webapp/components/DiscoverFilters.tsx`, `webapp/components/PillarChips.tsx`, `webapp/app/discover/page.tsx`

Changes:
- **Collapse separate filter controls into one pill**: `All · Last 3 months · 10x` — click opens a popover with Platform single-select + Time period + Min outlier
- Pillar chips: add **icon + color** per pillar (◆ ✦ □ ❤ ⊞ ♨ for Productivity/Self-improvement/Business/Health/ContentCreation/Psychology) — currently plain text
- **+ Add pillar** button at end of chip row — opens a dialog listing all `ext:*` taxonomy options (we'll seed ~50 in migration_010)
- **3 utility icons** top-right of pillar row: hide-seen toggle (`Eye` lucide with slash), hide-images toggle, refresh (`RefreshCw`)
- Default Time period: "Last 3 months" (not "all time")
- Default Min outlier: 10x

#### A.4 — Post card hover state (½ day)
Files: `webapp/components/PostCard.tsx`

Changes (mostly already shadcn'd):
- Confirm hover lift + border accent matches Eden
- Stats row: outlier pill (left, amber bg) + view/like/comment icons (lucide) + age (right)
- Bookmark icon position: bottom-right of card (we have it top-right currently)
- Platform badge: ensure exact colors (IG pink, YT red, X dark, LinkedIn sky, Substack orange, TikTok dark)

#### A.5 — Cmd+K palette upgrade (1 day) ⭐ HIGH-ROI
Files: `webapp/components/CommandPalette.tsx`, `webapp/app/api/search/route.ts`

Changes:
- **Actions section with 7 keyboard shortcuts**: New board (B), New folder (F), New document (D), New card (⇧C), Paste link (P), Toggle sidebar (⌘/), New chat (C). Each action wires to existing create endpoints.
- **Recent section** above results — recent canvases (read from `eden.recentBoards:<ws>` localStorage-equivalent we already have)
- Search results: show **nested doc subtitle** — when a document is inside a canvas, show parent canvas as subtitle
- **`⌥+⏎` side-peek** action — opens the result in workspace pane (Phase 11 already supports this)
- **`⌘D` duplicate** — clone the item
- Footer: `↕ navigate · ⏎ run · ⌥⏎ side peek · ⌘D duplicate`
- Use shadcn `Command` if available; otherwise stay with our Dialog wrapper

#### A.6 — Rotating chat status messages + loading skeletons (½ day)
Files: `webapp/components/ChatThread.tsx`

Changes:
- During streaming, before first reasoning token arrives, show rotating status: "Chasing the thread", "Connecting the dots", "Threading the needle", "Pulling at the thread", "Cooking it down" (random pick per chat)
- Confirm Suspense skeleton on every async surface (Discover, Boards, Chat, Workspace — already done in Phase 43)

**Phase A verification:** Open Eden + our app side by side. Within 10 minutes' inspection, you can't tell which is which on Home, Discover, Cmd+K. Sidebar layout matches. Chips have icons. Filter consolidated to one pill.

---

### PHASE B — Critical missing features (Weeks 2-3)

Goal: Add the 5 features that fundamentally change how the app feels. **Phase B.4 (enrichment) is the biggest unlock — schedule it first.**

#### B.4 — AI enrichment pipeline (3 days) ⭐⭐⭐ KILLER FEATURE — do this first

Files (new): `webapp/lib/enrich.ts`, `webapp/lib/types-enrichment.ts`, `webapp/app/api/enrich/route.ts`  
Files (modify): `webapp/lib/types.ts`, `supabase/migration_010_enrichment.sql`

Migration (new columns on `creator_posts`):
```sql
ALTER TABLE creator_posts
  ADD COLUMN taxonomy_id text,                    -- ext:t1__t2__t3
  ADD COLUMN taxonomy_label text,                 -- "Productivity › Automation › AI agents"
  ADD COLUMN taxonomy_tier1 text,                 -- "Productivity"
  ADD COLUMN content_type_label text,             -- "tutorial" | "explainer" | …
  ADD COLUMN media_format text,                   -- "short_video" | "long_video" | "image" | "carousel" | "article"
  ADD COLUMN mood text,                           -- "educational" | "motivational" | …
  ADD COLUMN ai_tags text[],
  ADD COLUMN ai_description text,
  ADD COLUMN ai_overview jsonb,                   -- {blocks: [{type, mechanic, openingLine, why, items, tone}]}
  ADD COLUMN enriched_at timestamptz,
  ADD COLUMN ai_overview_generated_at timestamptz;
CREATE INDEX ON creator_posts (taxonomy_tier1);
CREATE INDEX ON creator_posts (mood);
CREATE INDEX ON creator_posts USING gin (ai_tags);
```

`lib/enrich.ts` exposes:
```ts
export async function enrichPost(postId: string): Promise<EnrichmentResult> {
  // 1. Load creator_posts row + transcript + vision_analysis_md
  // 2. Single Gemini call with response_schema to return:
  //    taxonomy + content_type + media_format + mood + ai_tags + ai_description + ai_overview.blocks
  // 3. Write all enrichment columns
  // 4. Idempotent: re-running returns cached unless enriched_at < threshold
}

export async function enrichAllPending(limit = 100): Promise<void> {
  // Cron-ish: pick top 100 posts where enriched_at IS NULL, enrich in parallel (5 at a time)
}
```

Gemini prompt for enrichment (single call, structured JSON output):
- Input: title, caption, transcript, vision_analysis_md, platform, metrics
- Output: full enrichment object
- Reuse pillar taxonomy from migration_011

Integration:
- Modify `webapp/lib/dual-write.ts` `upsertCreatorPost` to push enrichment job after insert
- Modify `webapp/lib/ingest/youtube.ts` and `lib/ingest/substack.ts` likewise
- Hook into existing `sync.py` via webhook or polling

#### B.5 — Social-mirror CDN (2 days)

Files (new): `webapp/lib/mirror.ts`, `webapp/app/api/mirror/route.ts`  
Files (modify): `webapp/lib/dual-write.ts`, `lib/ingest/*`

Setup:
- Supabase Storage bucket `social-mirror` (public-read)
- Path format: `social-mirror/<platform>/<pk>/thumbnail.jpg`, `social-mirror/<platform>/profiles/<userId>/avatar-<sha256>.jpg`

`lib/mirror.ts`:
```ts
export async function mirrorThumbnail(post: CreatorPost): Promise<string> {
  // 1. Fetch original thumbnail URL with platform User-Agent (IG needs Referer trick)
  // 2. Upload to Supabase Storage at canonical path
  // 3. Return public URL
  // 4. Update creator_posts.thumbnail_url + media_mirror jsonb
}
export async function mirrorAvatar(creator: Creator): Promise<string> { ... }
```

Background:
- On every new creator_posts insert → queue thumbnail mirror
- On every creators update with new avatar → queue avatar mirror
- Add `media_mirror jsonb` column to creator_posts (mirrors Eden's structure)
- Update `webapp/components/PostCard.tsx` to prefer `media_mirror.thumbnail.url` over original

Killer side effect: deletes the entire `/api/ig-image` adblocker-bypass proxy.

#### B.1 — Post detail modal (3 days) ⭐ HIGH-VALUE

Files (new): `webapp/components/PostDetailModal.tsx`, `webapp/components/PostBoostMenu.tsx`  
Files (modify): `webapp/components/PostCard.tsx` (open modal on click instead of external link)

Structure (mimics Eden screenshot):
- shadcn Dialog full-screen-ish (`max-w-2xl`)
- Top bar: title + 4 action icons (⚡ boost · 🚫 hide · ⊕ save · 🔗 external · ✕ close)
- Creator header: avatar + handle + verified check + "View profile" button
- Embedded post (IG carousel paginated, YT player, etc.) — for now, simple `<img>` with the mirrored thumbnail
- Author footer: name + @handle + date
- Stats row: outlier pill + view/like/comment/engagement icons
- Caption section with "Copy" button
- **Vision Analysis section** rendering `ai_overview.blocks` with proper UI:
  - `type: "hook"` block → "Hook" badge + mechanic chip + opening line in quote + "why" italic
  - `type: "pullQuotes"` block → list of quotes with quote-mark styling
  - Other types: render generically with type label + content
- **Transcript** collapsible section

#### B.2 — Post-boost menu (6 presets) (3 days) ⭐⭐ HIGH-VALUE

Files (new): `webapp/lib/post-boost-presets.ts`, `webapp/components/PostBoostMenu.tsx`  
Files (modify): `webapp/app/api/boost/route.ts`, `webapp/lib/boost-starters.ts` (re-export pattern)

`lib/post-boost-presets.ts`:
```ts
export const POST_BOOST_PRESETS = {
  variations: { id, title: "Variations", iconName: "sparkles", accent: "violet",
    description: "Generate fresh angles", systemPrompt: [...], requiresTool: "showBoostVariations" },
  "expand-longform": { ... },
  "reverse-engineer": { ... },        // SAME systemPrompt as chat-tab content-breakdown
  replicate: { ... },
  "headline-variations": { ..., showWhen: (post) => post.media_format === "long_video" },
  "break-into-post-ideas": { ..., showWhen: (post) => ["long_video", "article"].includes(post.media_format) },
};
```

Verbatim system prompts (extracted from Eden's bundle in `eden-deep-dive.md` — reproduce in full here):
- **Variations**: "Discover Remix Boost mode is active for this turn. The user attached a SHORT-FORM social post from Discover and wants editable variations inspired by it. Call the showBoostVariations tool with 3 to 5 distinct variations. Each variation must be a finished, ready-to-publish short-form post (NOT an outline, NOT a multi-paragraph essay, NOT a thread). Keep the underlying idea and insight from the source, but change the hook, angle, structure, and framing. Do not copy unique phrasing from the source. # Format target: Instagram Reel caption…" + the full 7.6KB prompt with vocabulary/anchorStory/writingSample references + the em-dash ban + all the rules in `eden-deep-dive.md`
- Reverse Engineer = Content Breakdown — already in `lib/boost-starters.ts`, alias
- The remaining 4 are partial — backfill from Eden over the next session before shipping

`PostBoostMenu.tsx`:
- shadcn DropdownMenu opened from the ⚡ button in PostDetailModal
- Filter presets by `showWhen(post)` if defined
- Footer: "Boosts this month: X of 40" — but since we don't have quotas, show count without limit (or just `X used`)
- On click: POST to `/api/boost` with `{postId, presetId}`

`/api/boost/route.ts`:
- Receives `{postId, presetId, voiceId?}`
- Auto-generates user message markdown (Author + Platform + Format + Link + Post + Transcript)
- Looks up preset, gets system prompt
- Creates chat via existing chat creation flow
- Streams the response
- Returns `{chat_id}` so client can navigate (or open in pane)

#### B.3 — `showBoostVariations` tool output rendering (2 days) ⭐ HIGH-VALUE

Files (new): `webapp/components/VariationsCardList.tsx`, `webapp/lib/tools.ts`  
Files (modify): `webapp/app/api/chat/route.ts`, `webapp/components/ChatThread.tsx`

Tool schema (Gemini function calling):
```ts
showBoostVariations: {
  description: "Render 3-5 ready-to-publish variations as cards",
  parameters: {
    type: "object",
    properties: {
      variations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Tactic name e.g. 'Bold claim', 'Hot take'" },
            body: { type: "string", description: "Ready-to-publish caption" },
            why: { type: "string", description: "Why this works" }
          },
          required: ["label", "body", "why"]
        },
        minItems: 3, maxItems: 5
      }
    },
    required: ["variations"]
  }
}
```

Streaming integration:
- `/api/chat/route.ts` already streams SSE-ish ndjson; extend to emit `{type:"tool-call", name:"showBoostVariations", args:{...}}` events when Gemini returns a function call
- `ChatThread.tsx` recognizes the tool event and renders `<VariationsCardList />` inline in the assistant bubble (instead of plain markdown)
- Per-card buttons: "Insert to board" (saves as a card on the source board), section "Save all to board →"

**Phase B verification:**
1. Click a post in Discover → modal opens with thumbnail + stats + AI overview blocks rendered
2. Click ⚡ in modal → 4 boost options visible (Variations / Expand / Reverse Engineer / Replicate); 6 if post is long-form
3. Click Variations → workspace pane opens with chat → after 5-15 sec, see 3-5 cards titled with tactic names + Insert to board buttons
4. `creator_posts` rows for newly-ingested posts have `enriched_at` set within 5 minutes
5. Thumbnails load from `supabase…/social-mirror/...` (not original IG CDN)

---

### PHASE C — Backend depth (Weeks 4-6)

Goal: Make Discover smart, make outliers real, make chat reasoning visible, make voice profiles versioned.

#### C.1 — Pareto outlier baselines (3 days)

Files (new): `webapp/lib/outlier.ts`, `webapp/app/api/creators/[id]/baselines/route.ts`  
Files (modify): `webapp/lib/dual-write.ts`  
Migration: `supabase/migration_012_outlier_baselines.sql`

```sql
CREATE TABLE outlier_baselines (
  creator_id uuid REFERENCES creators(id) ON DELETE CASCADE,
  segment_id text NOT NULL,        -- "reel" | "post" | "default"
  metric_label text NOT NULL,      -- "views" | "likes"
  tau numeric NOT NULL,            -- threshold quantile
  median numeric NOT NULL,
  m_infinity numeric NOT NULL,
  sample_size integer NOT NULL,    -- typically 30
  computed_at timestamptz DEFAULT now(),
  PRIMARY KEY (creator_id, segment_id, metric_label)
);
```

Per-platform `tau` constants in `lib/outlier.ts`:
```ts
const TAU_BY_PLATFORM_SEGMENT = {
  instagram: { reel: 0.25, post: 0.25 },
  twitter:   { default: 0.4167 },
  youtube:   { video: 0.30, short: 0.25 },
  linkedin:  { default: 0.40 },
  substack:  { default: 0.50 },
  tiktok:    { default: 0.25 },
};
```

Algorithm (generalized Pareto tail fit):
```
1. Pull last 30 posts per (creator, segment) ordered by published_at DESC
2. Sort by metric (views/likes) ASC
3. median = the 50th-percentile value
4. mInfinity = a function of mean of the top (1-tau)*30 posts (location parameter for tail)
5. outlier_score per post = (metric_value - median) / (mInfinity - median)
6. Cache result; recompute on every Nth new post or weekly
```

Display "typical X" using `median` (matches Eden's "694 typical likes").

#### C.2 — Pillar taxonomy with `ext:` hierarchy (1 day)

Migration: `supabase/migration_011_pillars.sql`

```sql
CREATE TABLE pillar_taxonomy (
  taxonomy_id text PRIMARY KEY,        -- "ext:productivity__automation__ai_agents"
  label text NOT NULL,                  -- "Productivity › Automation › AI agents"
  tier1 text NOT NULL,                  -- "Productivity"
  tier2 text,                           -- "Automation"
  tier3 text,                           -- "AI agents"
  icon text,                            -- "rocket" lucide name
  color text                            -- "#a78bfa" hex
);

CREATE TABLE workspace_pinned_pillars (
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  taxonomy_id text REFERENCES pillar_taxonomy(taxonomy_id),
  position integer DEFAULT 0,
  pinned_at timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, taxonomy_id)
);
```

Seed top-level pillars (~6) + tier-2 (~30) + tier-3 (~100):
```
ext:productivity                 Productivity                ◆
ext:productivity__automation     Productivity › Automation
ext:productivity__automation__ai_agents
ext:self_improvement             Self-improvement            ✦
ext:business                     Business                    □
ext:health                       Health & fitness            ❤
ext:content_creation             Content creation            ⊞
ext:psychology                   Psychology                  ♨
…
```

Auto-create adaptive "For you" list:
- On first PATCH to `workspace_pinned_pillars` adding a pillar, INSERT into `creator_lists` with `kind="adaptive"`, `name="For you"`, `emoji="✨"`, `position=-1000`
- "For you" list membership is computed dynamically from pinned pillars (no `creator_list_members` rows — just a virtual filter)

Update `creator_lists` table:
```sql
ALTER TABLE creator_lists ADD COLUMN kind text DEFAULT 'curated';   -- "curated" | "adaptive"
ALTER TABLE creator_lists ADD COLUMN pillar_taxonomy_id text REFERENCES pillar_taxonomy(taxonomy_id);
ALTER TABLE creator_lists ADD COLUMN emoji text;
```

#### C.3 — Typesense cross-platform Discover (1 week) ⭐

Goal: Replace SQL filter on `/discover` with Typesense hybrid (BM25 + vector) search across all platforms.

Setup:
- Docker compose with Typesense locally (port 8108)
- Collection schema:
  ```json
  {
    "name": "content",
    "fields": [
      { "name": "id", "type": "string" },
      { "name": "platform", "type": "string", "facet": true },
      { "name": "title_or_caption", "type": "string" },
      { "name": "transcript", "type": "string", "optional": true },
      { "name": "ai_description", "type": "string", "optional": true },
      { "name": "ai_tags", "type": "string[]", "facet": true },
      { "name": "taxonomy_tier1", "type": "string", "facet": true },
      { "name": "mood", "type": "string", "facet": true },
      { "name": "outlier_multiplier", "type": "float" },
      { "name": "view_count", "type": "int64" },
      { "name": "like_count", "type": "int64" },
      { "name": "published_at", "type": "int64" },
      { "name": "embedding", "type": "float[]", "num_dim": 768,
        "embed": { "from": ["title_or_caption", "ai_description", "ai_tags"],
                   "model_config": { "model_name": "ts/all-MiniLM-L12-v2" } } }
    ],
    "default_sorting_field": "published_at"
  }
  ```

Files (new):
- `webapp/lib/typesense.ts` — client wrapper
- `webapp/lib/discover-engine.ts` — search orchestrator with relaxation
- `webapp/app/api/discover-v2/route.ts` — new endpoint

Ingest pipeline:
- On every `creator_posts` insert/update or enrichment completion → push to Typesense
- Background job to backfill existing rows
- Cron to refresh embeddings when ai_description changes

Discover orchestrator (`lib/discover-engine.ts`):
```ts
async function discover({ query, pillarTaxonomyIds, platforms, minOutlier, listId, since }) {
  // 1. Build typesense query (multi-field with BM25 + vector)
  // 2. Per-platform pool fetch: 80 results × 6 platforms = 480 candidates
  // 3. STRICT pass: apply all filters
  // 4. If results < 100, RELAXATION pass: drop minOutlier from query value to 5x
  // 5. Rerank: outlier_multiplier desc, then engagement_rate desc, then published_at desc
  // 6. Return { content, feedDiagnostics: { searchPath, quotas, poolSizes, relaxation, personalization } }
}
```

Match Eden's response shape exactly (see `eden-deep-dive.md` for the full shape).

#### C.4 — Interaction events + personalization (1 week)

Migration: `supabase/migration_013_events.sql`

```sql
CREATE TABLE post_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  content_id uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES creators(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  event_type text NOT NULL,        -- "view" | "dwell" | "impression" | "click" | "save" | "boost"
  dwell_ms integer,
  position integer,
  surface text,                    -- "feeds" | "profile" | "boost-modal"
  view_mode text,                  -- "grid" | "list"
  tab text,                        -- "discover" | "home" | "creators"
  metadata jsonb,
  occurred_at bigint NOT NULL      -- unix ms
);
CREATE INDEX ON post_events (workspace_id, occurred_at DESC);
CREATE INDEX ON post_events (workspace_id, event_type, occurred_at DESC);
```

Files (new):
- `webapp/app/api/events/content/route.ts` — batched POST endpoint
- `webapp/lib/event-tracker.ts` — client wrapper (debounces, batches)
- `webapp/lib/personalization.ts` — vector + ANN logic

Client integration in `PostCard.tsx`:
- Use IntersectionObserver to fire `impression` when post enters viewport
- Track `dwellMs` (time visible before leaving viewport)
- Batch 18+ events, flush every 5 seconds or on visibility change

Personalization (after 8+ signals):
- Compute workspace profile embedding: mean of last 50 viewed-post embeddings, weighted by dwellMs
- Use as a query vector for Typesense ANN search
- Merge ANN results into Discover orchestrator's pool

Diagnostics in `/api/discover-v2` response:
```ts
personalization: {
  enabled: true,
  eligible: signalCount >= 8,
  reason: signalCount < 8 ? "not_enough_signals" : "ready",
  signalWeight: 0.3,
  profileVectorDims: 768,
  annPoolSize: 50,
  annPoolMerged: 12,
  threshold: 8
}
```

#### C.5 — DeepSeek V4 via OpenRouter + reasoning streaming + max-mode (1 day) ⭐ COST WIN

Files (modify): `webapp/app/api/chat/route.ts`, `webapp/lib/chat-stream.ts`, `webapp/components/ChatThread.tsx`  
Env: add `OPENROUTER_API_KEY=...` to `.env.local`

Routing:
```ts
const MODEL_BY_MODE = {
  regular: "deepseek/deepseek-v4-pro",       // via OpenRouter
  max:     "google/gemini-2.5-pro",          // or "anthropic/claude-sonnet-4.6"
};
```

OpenRouter API integration via existing `@google/genai`-style client (or fall back to plain fetch — OpenRouter is OpenAI-compatible).

SSE event types we now emit (match Eden):
```
data: {"type":"start","messageMetadata":{"modelId":"deepseek/deepseek-v4-pro","creditsUsed":1}}
data: {"type":"reasoning-start","id":"gen-..."}
data: {"type":"reasoning-delta","delta":"The "}
data: {"type":"reasoning-delta","delta":"user "}
…
data: {"type":"text-start"}
data: {"type":"text-delta","delta":"I'm "}
…
data: {"type":"finish"}
```

`ChatThread.tsx` updates:
- Render `reasoning-*` events into a collapsible **"Thoughts ▾"** section above the message bubble
- Render `text-*` events into the main bubble
- Track `messageMetadata.modelId` and show as a tiny badge below the bubble ("DeepSeek V4 Pro")

UI control for mode:
- In `NewChatHome.tsx` and `ChatThread.tsx` input bar, add a small toggle: "regular | max" (default: regular)
- Default to `max` only for post-level boosts (matches Eden)

#### C.6 — Voice card v0/v1 versioning + carry-forward rule (2 days)

Migration: `supabase/migration_014_voice_card.sql`

```sql
-- Repurpose existing voices table; add carry-forward fields
ALTER TABLE voices ADD COLUMN version text DEFAULT 'v1';
ALTER TABLE voices ADD COLUMN history jsonb DEFAULT '[]';   -- array of prior versions
ALTER TABLE voices ADD COLUMN vocabulary text[];
ALTER TABLE voices ADD COLUMN writing_samples text[];
ALTER TABLE voices ADD COLUMN anchor_stories text[];
ALTER TABLE voices ADD COLUMN format_scaffolds text[];
ALTER TABLE voices ADD COLUMN tone_tags text[];
ALTER TABLE voices ADD COLUMN rhythm text;
ALTER TABLE voices ADD COLUMN format_habits text;
ALTER TABLE voices ADD COLUMN prefer text[];
ALTER TABLE voices ADD COLUMN avoid text[];
```

Carry-forward enforced in `lib/voice.ts`:
```ts
export async function saveVoice(voiceId, partial, options = {}) {
  const prev = await getVoice(voiceId);
  // Merge: prev fields are preserved; partial overrides per-field
  const next = { ...prev, ...partial, version: bumpVersion(prev.version) };
  // Push prev into history
  next.history = [...(prev.history || []), { snapshot: prev, version: prev.version, ts: Date.now() }].slice(-20);
  await db.update(...);
}
```

Build-voice flow:
- Update Voice Builder system prompt with the "ship v0 save card early" instruction (we have the prompt opener; add the back-half rules)
- After 2-3 user turns, LLM is instructed to call `saveVoice(voiceId, partial, { version: "v0" })`
- Subsequent refinements bump to v1, v1.1, etc.

**Phase C verification:**
1. New post enriched in <30 sec, shows `taxonomy_label` in card
2. `/api/discover-v2` returns feedDiagnostics with `searchPath: "typesense-hybrid"`, poolSizes per platform
3. After clicking 8+ posts, refresh Discover — `personalization.eligible: true`, reranks visibly
4. Chat shows "Thoughts ▾" collapsible above main response
5. Voice library shows version label (v0, v1, etc.)
6. Outlier scores match `(metric - median) / (mInfinity - median)` formula

---

### PHASE D — Infinite canvas + polish (Week 7)

#### D.1 — Boards as infinite canvas (4 days) ⭐

Files (new): `webapp/components/InfiniteCanvas.tsx`, `webapp/components/BoardItemEmbed.tsx`  
Files (modify): `webapp/components/BoardClient.tsx`, `webapp/app/boards/[id]/page.tsx`  
Migration: `supabase/migration_015_canvas_state.sql`

Library decision: **`@xyflow/react`** (formerly react-flow) — supports pan/zoom, custom node renderers, free-form positioning. Lighter than tldraw.

```sql
ALTER TABLE board_items ADD COLUMN x integer DEFAULT 0;
ALTER TABLE board_items ADD COLUMN y integer DEFAULT 0;
ALTER TABLE board_items ADD COLUMN w integer DEFAULT 300;
ALTER TABLE board_items ADD COLUMN h integer DEFAULT 400;
```

Each item type gets a custom node renderer:
- `BoardItemPostNode` — embeds the social post with platform-style chrome (IG carousel paginated dots, X embed, YT player, Substack article preview)
- `BoardItemCardNode` — text card with colored background
- `BoardItemDocumentNode` — markdown preview with "Open document" link
- `BoardItemFileNode` — file icon + name + size

Camera state persisted to `localStorage[canvas-camera-cache:v1:<wsId>:<boardId>] = {position:{x,y}, zoom, updatedAt}` (matches Eden exactly).

Sub-tag tabs (e.g. "All / AI Carousels") at top of board:
- Pull distinct `board_items.tag` values for the board
- Click filters visible items
- Each tab has a colored dot indicator (deterministic color from tag string hash)

Top-right of board:
- **Chat** button — opens chat with this board as context (existing `/api/boards/[id]/chat` flow)
- **Share** button — generate public share link (stub for now — `guestViewerId` system)
- **Settings** ⚙ — board name, voice, delete

#### D.2 — Mic + ElevenLabs TTS (3 days)

Files (new): `webapp/components/MicButton.tsx`, `webapp/components/VoicePickerEveMax.tsx`, `webapp/lib/elevenlabs.ts`, `webapp/app/api/transcribe/route.ts`, `webapp/app/api/tts/route.ts`  
Env: add `ELEVENLABS_API_KEY=...`, `WHISPER_API_KEY=...` (or Groq)

Mic flow:
- Click 🎤 → request mic permission → start MediaRecorder
- Click again to stop → POST audio blob to `/api/transcribe`
- Use Groq Whisper (`whisper-large-v3-turbo`, fast + cheap) — POST audio, return text
- Insert text into chat input

TTS flow:
- "Eve Max ⌄" dropdown opens with ElevenLabs voice list (load via their API or hardcoded set: Eve Max, Aria, Antoni, etc.)
- Stream the assistant's text response through ElevenLabs streaming TTS
- Audio plays in parallel with text generation

User preference: store default voice ID on `users` row (or workspace), auto-play toggle in Settings.

#### D.3 — Cmd+K side-peek + duplicate (1 day)

Files (modify): `webapp/components/CommandPalette.tsx`, `webapp/lib/panes.ts`

- `⌥+⏎` on a result → open it in workspace pane via `openInWorkspaceUrl({ kind, id })` (already exists in `lib/panes.ts`)
- `⌘D` on a result → call duplicate endpoint per kind (board/document/card)

#### D.4 — Onboarding social scan (1 day)

Files (new): `webapp/components/OnboardingHandlesForm.tsx`  
Files (modify): `webapp/app/onboarding/page.tsx` (if exists; else create), workspace setup flow

Flow:
- After workspace creation, show a "Get a head start" screen
- Ask for handles across IG/YT/X (just IG for now since we have it)
- On submit, kick off background `/api/profiles/analyze` per handle
- Redirect to Home — by the time user lands, Discover has data

---

## Inlined: All 10 boost prompts (verbatim where extracted)

The full text of all 5 chat-tab boosts and 6 post-level boosts is reproduced verbatim in:
- `webapp/docs/eden-architecture.md` §10 (all 5 chat-tab prompts in full + the C8 protocol verbatim)
- `webapp/docs/eden-deep-dive.md` §5-7 (Niche Playbook full, Grade My Content full, Thinking Partner's "thinking-style" influence list)

When implementing, copy these strings verbatim into `lib/boost-starters.ts` and `lib/post-boost-presets.ts`. **Append the C8 conversation protocol to every single one** — Eden does this universally.

The 4 post-level boosts whose prompts we have NOT yet extracted (Expand to Longform, Replicate, Headline Variations, Break into Post Ideas) need one more 20-minute browser session to capture before B.2 ships. Variations and Reverse Engineer are fully captured.

---

## Inlined: 19 screens

ASCII layouts for every screen are in `webapp/docs/eden-ui-replica-plan.md` §Screen 1 through §Screen 19. Reproduced screens:

1. Home (`/`) — headline + checklist + templates + My lists
2. Cmd+K palette (Dialog) — actions + recent + search results
3. Discover (`/discover`) — pillar chips + filter pill + utility icons + grid
4. Discover filter popover — platform/time/min-outlier
5. **Post detail modal** ⭐ — full embed + AI overview blocks + boost menu trigger
6. **Post boost menu** ⭐ — 4-6 conditional boosts + monthly counter
7. **Boost output (Variations result)** ⭐ — Variations header + Save-all + card list with Insert-to-board
8. Chat new (`/chat`) — headline + input + Recent + Boosts column
9. Chat with preset attached — preset attachment card + status message + Thoughts
10. **Board canvas (infinite)** ⭐ — sub-tag tabs + free-form embedded post cards + Chat/Share/Settings
11. Workspace switcher dropdown — Settings/Billing/Sign out
12. Creators tab — top-creators-to-follow default + search
13. Creator detail page — bio + typical likes + all caught up + post grid
14. Build voice modal (3 options) — chat/links/archetype with badges
15. Voice library `/voice` — list of saved voices
16. My Lists tab — adaptive + curated lists
17. @-mention popover — 3 tabs (Items/Creators/Lists)
18. Settings (placeholder) — profile + voice + Discord + Loops
19. Billing page (placeholder — skipped per scope decision)

Stars mark the screens that require NEW components — the rest are polish on existing.

---

## Critical files (pattern + representative paths)

### New files to create (28 total)
```
webapp/
├── lib/
│   ├── enrich.ts                          ★ B.4
│   ├── types-enrichment.ts                ★ B.4
│   ├── mirror.ts                          ★ B.5
│   ├── post-boost-presets.ts              ★ B.2
│   ├── tools.ts                           ★ B.3 (showBoostVariations schema)
│   ├── outlier.ts                         ★ C.1
│   ├── typesense.ts                       ★ C.3
│   ├── discover-engine.ts                 ★ C.3
│   ├── event-tracker.ts                   ★ C.4
│   ├── personalization.ts                 ★ C.4
│   ├── elevenlabs.ts                      ★ D.2
├── components/
│   ├── PostDetailModal.tsx                ★ B.1
│   ├── PostBoostMenu.tsx                  ★ B.2
│   ├── VariationsCardList.tsx             ★ B.3
│   ├── InfiniteCanvas.tsx                 ★ D.1
│   ├── BoardItemEmbed.tsx                 ★ D.1
│   ├── MicButton.tsx                      ★ D.2
│   ├── VoicePickerEveMax.tsx              ★ D.2
│   ├── OnboardingHandlesForm.tsx          ★ D.4
├── app/api/
│   ├── enrich/route.ts                    ★ B.4
│   ├── mirror/route.ts                    ★ B.5
│   ├── events/content/route.ts            ★ C.4
│   ├── discover-v2/route.ts               ★ C.3
│   ├── transcribe/route.ts                ★ D.2
│   ├── tts/route.ts                       ★ D.2
│   ├── creators/[id]/baselines/route.ts   ★ C.1
└── docs/
    └── (already done)
supabase/
├── migration_010_enrichment.sql           ★ B.4
├── migration_011_pillars.sql              ★ C.2
├── migration_012_outlier_baselines.sql    ★ C.1
├── migration_013_events.sql               ★ C.4
├── migration_014_voice_card.sql           ★ C.6
└── migration_015_canvas_state.sql         ★ D.1
```

### Files to modify
```
webapp/components/Sidebar.tsx               A.1
webapp/components/WorkspaceSwitcher.tsx     A.1
webapp/app/page.tsx                         A.2
webapp/components/DiscoverFilters.tsx       A.3
webapp/components/PillarChips.tsx           A.3
webapp/app/discover/page.tsx                A.3 + C.3 (swap to discover-v2)
webapp/components/PostCard.tsx              A.4 + B.1 + B.5 + C.4
webapp/components/CommandPalette.tsx        A.5 + D.3
webapp/components/ChatThread.tsx            A.6 + B.3 + C.5
webapp/lib/boost-starters.ts                add C8 protocol
webapp/lib/boost-presets.ts                 align with post-boost-presets
webapp/app/api/boost/route.ts               B.2 (route post-level boosts)
webapp/app/api/chat/route.ts                B.3 + C.5
webapp/lib/chat-stream.ts                   C.5 (reasoning events)
webapp/lib/dual-write.ts                    B.4 + B.5 (enqueue jobs)
webapp/lib/ingest/youtube.ts                B.4 + B.5
webapp/lib/ingest/substack.ts               B.4 + B.5
webapp/lib/ingest/instagram (via sync.py)   B.4 + B.5
webapp/lib/types.ts                         B.4 + C.2 + C.4 + C.6
webapp/components/BoardClient.tsx           D.1 (rewrite with InfiniteCanvas)
webapp/app/boards/[id]/page.tsx             D.1
webapp/components/VoiceLibraryClient.tsx    C.6 (show version, history)
webapp/components/BuildVoiceModal.tsx       C.6 (3-option polish)
webapp/components/PostBoostMenu.tsx         B.2
webapp/lib/voice.ts                         C.6 (carry-forward)
webapp/next.config.ts                       D.2 (env passthrough if needed)
webapp/.env.local                           C.5 + D.2 (OPENROUTER_API_KEY, ELEVENLABS_API_KEY, WHISPER_API_KEY)
```

### Existing functions / utilities to reuse (do NOT recreate)
- `webapp/lib/dual-write.ts::upsertCreatorPost` — already writes to creator_posts; extend to enqueue enrichment + mirror
- `webapp/lib/proxy-image.ts::igImg` — keep for fallback; remove uses once mirror.ts is hot
- `webapp/lib/instagram.ts::fetchProfile`, `fetchMediaByPk`, `bestVideoUrl`, `bestImageUrl`, `downloadFromIG` — still the right primitives
- `webapp/lib/ingest/youtube.ts::resolveChannel`, `ingestYouTubeChannel` — unchanged
- `webapp/lib/ingest/substack.ts::ingestSubstackPublication` — unchanged
- `webapp/lib/chat-context.ts::buildSystemPrompt` — extend to inject voice profile fields
- `webapp/lib/panes.ts::openInWorkspaceUrl` — reused by Cmd+K side-peek (D.3)
- `webapp/components/PaneShell.tsx`, `PaneFrame.tsx` — Phase 11 multi-pane already works; post-boost output should open in a pane
- `webapp/components/MarkdownView.tsx` — reused everywhere
- `webapp/lib/boost-starters.ts` — keep, just add C8 protocol + fill in any missing prompts
- `webapp/lib/voice.ts::assembleVoicePrompt` — extend with new schema fields
- `webapp/components/MentionAutocomplete.tsx` — already exists, just verify it matches Eden's exact 3-tab style (it does)
- `webapp/app/api/chat-autocomplete/route.ts` — unchanged

---

## Risk register & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gemini enrichment cost balloons | medium | medium | Cache forever, dedupe identical posts, batch up to 5 in parallel, cap daily spend via env var |
| Typesense local-only is brittle for production | low | medium | Ship docker-compose for dev; for production use Typesense Cloud free tier (10K records) or fly.io self-host |
| DeepSeek V4 produces lower quality outputs than Gemini | medium | medium | Keep Gemini Pro as default for `max` mode; A/B compare DeepSeek vs Gemini on a fixed prompt before full cutover |
| Em-dash ban breaks markdown rendering | low | low | Validate output post-stream; replace em dashes with hyphens or full stops |
| ElevenLabs cost (TTS) is per-character | medium | medium | Cap chars per TTS call; show usage meter; allow opt-out per-chat |
| Infinite canvas drag performance with 100+ items | medium | medium | Use react-flow's built-in virtualization; lazy-mount post embeds via IntersectionObserver |
| Personalization vector compute load | low | low | Compute lazily on every 8th signal, not every signal |
| Post detail modal embed fidelity (IG carousel pagination, X embed) is a rabbit hole | high | medium | Ship MVP with thumbnail + caption + stats only; defer real platform embeds to a follow-up |

---

## Verification plan

End-to-end smoke test after each phase:
- **Phase A:** Side-by-side screenshot comparison with Eden on Home, Discover, Cmd+K, Post card. No regressions on existing routes.
- **Phase B:** Click any post → modal opens with enrichment blocks. Click ⚡ → 4-6 boost options. Click Variations → 3-5 cards stream in within 20s. Thumbnails load from `social-mirror/...` URLs.
- **Phase C:** `/discover-v2` returns `feedDiagnostics.searchPath`. Outlier scores match formula. Personalization activates after 8 interactions. Chat shows "Thoughts ▾". Voice has `version: "v1"` field.
- **Phase D:** Boards open as infinite canvas; drag, zoom, sub-tag filter work. Mic transcribes a 30-sec voice memo into text. TTS plays Eve Max voice on assistant response.

Full route smoke test after each merge:
```bash
for r in / /chat /discover /boards /workspace /creators /voice /saves /ideate /ideas; do
  curl -s -o /dev/null -w "$r → %{http_code}\n" http://localhost:3000$r
done
```
All must return 200.

TypeScript strict mode must remain clean:
```bash
cd webapp && npx tsc --noEmit
```

---

## Open questions before kickoff

1. **DeepSeek vs Gemini for `regular` mode default**: do we want to actually switch the default model, or keep Gemini and just add the toggle UI? The 10× cost differential argues for DeepSeek but quality on creative-writing tasks may be worse. Recommendation: ship the toggle in C.5, default to Gemini, A/B for 1 week, then flip if DeepSeek holds.

2. **Local Typesense vs Postgres FTS**: for personal-scale (a few thousand posts), Postgres `tsvector + pgvector` may be enough and saves operating a separate service. Recommendation: start with pgvector + tsvector via a new Supabase migration, evaluate if quality is good enough, only move to Typesense if hybrid ranking is necessary.

3. **Onboarding social scan scope (D.4)**: just IG (what we have) or also YT and Substack? Recommendation: ship just IG initially since users likely have IG; add YT/Substack via the existing /api/ingest dispatcher in a follow-up.

4. **Voice profile location**: `users.voice_profile` (per-user, travels across workspaces) vs `workspace_voices` (per-workspace). Eden has it on user. Recommendation: per-user, but allow override per-workspace via existing `voices` table.

5. **Em-dash policy globally?** Apply Variations boost's em-dash ban to ALL our LLM outputs, or just that boost? Recommendation: apply globally — it's the #1 AI-text tell.

---

## Sequencing (the one-page summary)

```
Week 1     Phase A    Visual polish
           ├─ A.1   Sidebar (workspace switcher actions)            ½d
           ├─ A.2   Home headlines + filter pills                   ½d
           ├─ A.3   Discover filter consolidation + utility icons   1d
           ├─ A.4   PostCard hover state                            ½d
           ├─ A.5   Cmd+K with 7 actions + side-peek + duplicate    1d  ⭐
           └─ A.6   Rotating chat status                            ½d

Week 2-3   Phase B    Critical missing features
           ├─ B.4   AI ENRICHMENT PIPELINE                          3d  ⭐⭐⭐
           ├─ B.5   Social-mirror CDN                               2d
           ├─ B.1   Post detail modal                               3d  ⭐
           ├─ B.2   Post-boost menu (6 presets)                     3d  ⭐⭐
           └─ B.3   showBoostVariations tool render                 2d  ⭐

Week 4-6   Phase C    Backend depth
           ├─ C.5   DeepSeek + max-mode + reasoning streaming       1d  ⭐
           ├─ C.2   Pillar taxonomy                                 1d
           ├─ C.1   Pareto outlier baselines                        3d
           ├─ C.6   Voice card v0/v1 versioning                     2d
           ├─ C.3   Typesense / pgvector Discover                   7d
           └─ C.4   Interaction events + personalization            7d

Week 7     Phase D    Infinite canvas + polish
           ├─ D.1   Boards as infinite canvas (react-flow)          4d  ⭐
           ├─ D.2   Mic + ElevenLabs TTS                            3d
           ├─ D.3   Cmd+K side-peek + duplicate                     1d
           └─ D.4   Onboarding social scan                          1d
```

**Single biggest unlock:** B.4 AI enrichment pipeline. Schedule it Week 2 day 1. Everything downstream gets dramatically richer once `creator_posts.ai_overview.blocks` is populated.

**Single fastest visible win:** A.5 Cmd+K upgrade. 1 day, makes the app feel like a different product.
