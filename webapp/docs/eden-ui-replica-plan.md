# Eden UI replica plan — every screen, every behavior

Companion to `eden-deep-dive.md` (architecture) and `eden-architecture.md` (overview). This doc is the **visual + interaction spec** — every unique screen Eden has, what it contains, the API it triggers, and the exact implementation steps to replicate.

Captured live on 2026-05-26 from `app.eden.so/w/gangadhar-s-workspace/*`.

## Quick stats

- **19 unique screens** identified
- **10 total boost prompts** (5 chat-tab + 6 post-level, 1 shared)
- **2 chat title patterns**: "Help me think through…" (chat-tab boost) vs "Remix '<post caption>'" (post-level boost)
- **Headlines rotate randomly** — confirmed at least: "Where do we start today?", "Pick your next move.", "Time to make something.", "Almost there — one more setup step.", "What are we shipping today?", **"What's on your mind?"**, **"Welcome back."**

---

## Screen 1 — Home

```
┌─────────┬──────────────────────────────────────────────────────────────┐
│ FIND/CR │                  ✨ What's on your mind?                      │
│ ─⌘K───  │                                                              │
│ ⌂ Home  │  Getting started              3/4 ████░    Starter templates │
│ ↗ Disc. │  ┌─────────────────────────┐  ┌──────────────────────────┐   │
│ 💬 Chat │  │ ◯ Build your voice      │  │ 📺 Viral Reels & Shorts  │   │
│         │  │   Train Eden…  [Build v]│  │    Write viral reels…    │   │
│ Today   │  ├─────────────────────────┤  ├──────────────────────────┤   │
│ • Remix │  │ ✓ Create your first board│  │ 𝕏 Viral Tweets           │   │
│ • Help  │  │ ✓ Use a boost            │  │ ▶ Viral YouTube Videos   │   │
│ • Build │  │ ✓ Add creators to a list │  │ 📅 Weekly Content Wflow  │   │
│         │  └─────────────────────────┘  └──────────────────────────┘   │
│ Workspc │                                                              │
│ □ AI    │  My lists                                Add creators →      │
│ □ Viral │  (All Following 1) (AI Creatives 1)                          │
│         │                                                              │
│         │  Recent · Top liked · Top viewed · Top outlier · ⊕ Twitter ⌄ │
│         │  [post grid…]                                                │
└─────────┘
```

### What loads
- `GET /workspaces/<ws>/discover-hidden` → hide-seen list
- `GET /workspaces/<ws>/feed-pillars` → pinned pillars  
- `GET /workspaces/<ws>/lists` → user lists
- `GET /workspaces/<ws>/lists/<defaultListId>/members` → first list's creators
- (No /search/discover here — Home is following-mode-only)

### Interactions
- **Filter chips**: All Following · AI Creatives · …each list. Click switches `following.mode = "only"` with that `listId`.
- **Sort tabs**: Recent · Top liked · Top viewed · Top outlier — maps to `orderBy` param
- **Platform dropdown** (top-right): All platforms / Twitter / YouTube / TikTok / Instagram / Substack / LinkedIn. Single-select. Stored in localStorage `home-following-filter:v1`.
- **Time period dropdown** (in same filter popover): Week / Month / 3 months / Year / All time. Default: Year.
- **Posts per list**: Different from Discover — these are FOLLOWED creators' posts (simple SQL filter)

### Our gaps to close
- Add rotating headlines (we already have 5; add "What's on your mind?" and "Welcome back.")
- Add 2nd starter template column to right side (we hide them on small screens)
- Add platform dropdown to Home (we put it on Discover only)

---

## Screen 2 — Cmd+K command palette

```
┌─────────────────────────────────────────────────────┐
│ 🔍 Search workspace…                                │
├─────────────────────────────────────────────────────┤
│ ACTIONS                                              │
│ ⊞ New board                                      [B] │
│ 📁 New folder                                    [F] │
│ 📄 New document                                  [D] │
│ ▭ New card                                    [⇧C]   │
│ 🔗 Paste link                                    [P] │
│ □ Toggle sidebar                                [⌘/] │
│ 💬 New chat                                      [C] │
├─────────────────────────────────────────────────────┤
│ RECENT                                               │
│ ⊞ Viral Reels & Shorts                       Canvas │
│ ⊞ AI Inspo                                   Canvas │
├─────────────────────────────────────────────────────┤
│              ↕ navigate ⏎ run                        │
└─────────────────────────────────────────────────────┘
```

### When typing "viral"
```
┌─────────────────────────────────────────────────────┐
│ 🔍 viral                                             │
├─────────────────────────────────────────────────────┤
│ RESULTS                                              │
│ ⊞ Viral Reels & Shorts                       Canvas │
│ 📄 How to use the Viral Reels template               │
│      Viral Reels & Shorts                            │
│      # How to use the Viral Reels template…          │
│ 📄 Reels Knowledge                                   │
│      Viral Reels & Shorts                            │
│      …everything it needs to know to write viral…    │
├─────────────────────────────────────────────────────┤
│ 3 results · ↕ navigate · ⏎ open · ⌥+↵ side peek · ⌘D duplicate │
└─────────────────────────────────────────────────────┘
```

### Our gaps
- **Add 7 action shortcuts**: New board (B), New folder (F), New document (D), New card (⇧C), Paste link (P), Toggle sidebar (⌘/), New chat (C)
- **Add "side peek"** — open hit in workspace pane (⌥+⏎)
- **Add "duplicate"** — clone hit (⌘D)
- **Recent section** above results
- **Search across folders** (nested docs show their parent canvas as subtitle)

---

## Screen 3 — Discover (open mode)

```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 [stoici…  placeholder]              All · Last 3 months · 10x │
├──────────────────────────────────────────────────────────────┤
│ Discover  Creators  My Lists                                  │
│                                                              │
│ All  ◆ Productivity  ✦ Self-improvement  □ Business         │
│   ❤ Health & fitness  ⊞ Content creation  ♨ Psychology      │
│   + Add                          [hide-seen] [hide-img] [↻]  │
│                                                              │
│ ┌─────┬─────┬─────┬─────┐                                   │
│ │ post│ post│ post│ post│  (cross-platform mixed feed)       │
│ └─────┴─────┴─────┴─────┘                                   │
└──────────────────────────────────────────────────────────────┘
```

### What loads
- `GET /workspaces/<ws>/discover-hidden`
- `GET /workspaces/<ws>/feed-pillars`
- `GET /workspaces/<ws>/lists`
- `GET /search/usage?workspaceId=<ws>` — daily AI search quota
- `GET /workspaces/<ws>/lists/<id>/members` — for the active list
- `GET /search/discover?…` — **THE big call** (97 KB response)

### Top filter pill
- **"All · Last 3 months · 10x"** — this is the FILTER PILL summarizing active filters
- Click opens a popover with: Platform single-select, Time period single-select
- Default time period: **Last 3 months**, default outlier: **10x**

### Pillar chips behavior
- Pillars are hierarchical with `ext:` prefix
- Click a chip → PATCHes `/feed-pillars` with new array
- Pinning a NEW pillar **auto-creates a "For you" adaptive list**
- `+ Add` opens a multiselect of available `ext:*` taxonomies

### Utility icons (top right)
1. **🚫** (eye-slash) — "hide-seen" toggle. Removes posts already shown
2. **🖼** (image-with-slash) — "hide-images" toggle. Hides non-video posts? Or vice versa
3. **↻** (refresh) — refetch feed, ignores cache

### Our gaps
- Search bar with rotating placeholder text (we saw "stoici…", "building in public revenue updates", "ai marketing hooks", etc — these are example queries that rotate)
- Pillar chips with proper colors/icons (we have basic chips, no icons)
- + Add pillar modal
- 3 utility icons (we have none)
- "All · Last 3 months · 10x" pill summary (we have separate filter controls)
- "Last 3 months" + "10x" as default filters (we default to all-time, no outlier filter)

---

## Screen 4 — Discover filter popover (open)

```
┌──────────────────────────────┐
│ PLATFORM                     │
│  ⊞ All platforms          ✓  │
│  𝕏 Twitter                   │
│  ▶ YouTube                   │
│  ♪ TikTok                    │
│  📷 Instagram                │
│  📰 Substack                 │
│  in LinkedIn                 │
│                              │
│ TIME PERIOD                  │
│   Week                       │
│   Month                      │
│   3 months                   │
│   Year                    ✓  │
│   All time                   │
│                              │
│ MIN OUTLIER  (likely)        │
│   1x   3x   5x   10x      ✓  │
└──────────────────────────────┘
```

---

## Screen 5 — Post detail modal (clicking a post)

```
┌─────────────────────────────────────────────────────────────┐
│ 📷 Comment stack and follow me and…   ⚡  🚫  ⊕  🔗  ✕    │
├─────────────────────────────────────────────────────────────┤
│ [@gregisenberg ✓]  Original audio        [View profile]    │
│                                                             │
│           ┌──────────────────────────┐                      │
│           │                          │                      │
│           │     Comment "Stack"      │                      │
│           │                          │                      │
│           │     [video thumbnail]    │                      │
│           │     [play button overlay]│                      │
│           │                          │                      │
│           └──────────────────────────┘                      │
│                                                             │
│ ⊙ Greg Isenberg  @gregisenberg · Mar 29, 2026, 12:45 AM    │
│ ⚡ 44x vs views  👁 724K views  ❤ 31K  💬 17K  ❤ 6.63% eng │
│                                                             │
│ CAPTION                                          📋 Copy    │
│ Comment stack and follow me and I'll send you a free        │
│ tutorial                                                    │
└─────────────────────────────────────────────────────────────┘
```

### What loads on click
- `GET /content/<platform>/<id>` → full post payload with transcript
- `POST /events/content` → batched view+click events

### Top action bar (4 icons + close)
- **⚡** Boost — opens boost menu (Screen 6)
- **🚫** Hide — adds to `discover-hidden` list, post disappears from feed
- **⊕** Save to board — opens add-to-board menu
- **🔗** Share/external — opens platform URL in new tab
- **✕** Close modal

### Stats row (lightning + 4 metrics)
- `⚡ 44x vs views` — outlierScore (purple/amber pill)
- `👁 724K views`
- `❤ 31K likes`
- `💬 17K comments`
- `❤ 6.63% eng. rate`

### Caption section
- Header "CAPTION" + Copy button
- Original platform caption text (verbatim)

### Below (scrolled — not visible in screenshot)
- **TRANSCRIPT** section (auto-extracted from video)
- **VISION ANALYSIS** / **AI OVERVIEW** — the `enrichment.aiOverview.blocks` rendered as structured cards (hook block, pull quotes, etc.)
- **MEDIA MIRROR** info (when mirrored, file size)

### Our gaps
- We don't have a modal at all — we link out to the platform. **This is a critical missing piece.**
- We don't render `aiOverview.blocks` (we don't even have that field yet)
- We don't show transcript
- No Copy button on caption
- No Hide action

---

## Screen 6 — Post boost menu (clicking ⚡ in modal)

```
       ┌─────────────────────────────────────────┐
       │ BOOST                                    │
       │                                          │
       │ ✦ Variations                             │
       │    Generate fresh angles                 │
       │                                          │
       │ ↔ Expand to Longform                     │
       │    Draft a full piece from this          │
       │                                          │
       │ 🔍 Reverse Engineer                       │
       │    Break down why it works               │
       │                                          │
       │ ↻ Replicate                              │
       │    Use the structure yourself            │
       │                                          │
       │ Boosts this month        0 of 40        │
       └─────────────────────────────────────────┘
```

### Conditional boosts (NOT in this view but exist in bundle)
- `Headline Variations` ✦ — "Brainstorm titles for your niche" (shown only for long videos with titles, probably)
- `Break into Post Ideas` ◧ — (shown for long-form content)

### Boost preset IDs (from bundle)
- `variations` / "discover-remix" (system prompt opens with "Discover Remix Boost mode is active for this turn")
- `expand-longform`
- `reverse-engineer` — **same prompt as chat-tab `content-breakdown`**
- `replicate`
- `headline-variations` (conditional)
- `break-into-post-ideas` (conditional)

### What clicking a boost fires
```http
POST /chats  body: {workspaceId}
→ creates chat, returns chatId
POST /chats/<chatId>/messages
body: {
  message: {
    parts: [{ type: "text", text: "> ### Remix this post\n> - **Author:** [...]...\n> - **Transcript:** ..." }],
    metadata: { presetAttachment: { presetId: "variations", title: "Variations", ... } }
  },
  mode: "max",
  systemPrompt: "Discover Remix Boost mode is active...",
  spaceId: <currentBoardId>,
  canvasContext: { zoom, selectedElementIds, visibleElementIds }
}
```

### Our gaps
- We don't have a post-boost menu (only the chat-tab boosts)
- We need 4 (or 6) new boost presets with their full system prompts
- Footer counter "Boosts this month X of 40" — we have no monthly quota
- Conditional boosts based on `mediaFormat` (long_video → show Headline Variations)

---

## Screen 7 — Boost output (Variations result)

```
┌──────────────────────────────────────────────────────────┐
│ 💬 Remix "Comment stack and f…"          ⊕  ⊟  ↗  ✕      │
├──────────────────────────────────────────────────────────┤
│ ⚡ Variations                                             │
│   Comment stack and follow me and I'll send you a free   │
│   tutorial                                                │
│   instagram                                              │
│                                                          │
│ ▾ Thoughts                                               │
│                                                          │
│ Variations                              Save all to board → │
│                                                          │
│ ┌──────────────────────────────────────────────────┐    │
│ │ Bold claim                       Insert to board  │   │
│ │                                                   │   │
│ │ Most people use 10% of Claude.                    │   │
│ │                                                   │   │
│ │ Not because they're bad at prompting.             │   │
│ │                                                   │   │
│ │ Because Claude doesn't know who they are.         │   │
│ │                                                   │   │
│ │ Give it an onboarding file. Everything changes.   │   │
│ │                                                   │   │
│ │ Frames the 10% stat as the hook, then pivots…    │   │
│ └──────────────────────────────────────────────────┘    │
│                                                          │
│ ┌── Hot take ────────────────────────────────────┐      │
│ │ You're not bad at AI.                          │      │
│ │ You just never gave it a memory.               │      │
│ │ …                                              │      │
│ │ Rejects the common insecurity…                 │      │
│ └────────────────────────────────────────────────┘      │
│                                                          │
│ ┌── Substitution ────────────────────────────────┐      │
│ │ Stop prompt engineering.                       │      │
│ │ Start agent onboarding.                        │      │
│ └────────────────────────────────────────────────┘      │
│                                                          │
│ [+ chat input]                          Eve Max ⌄ 🎤 ↑  │
└──────────────────────────────────────────────────────────┘
```

### Output structure (tool call: `showBoostVariations`)
Each variation card has:
- **Label** (tactic name: "Bold claim", "Hot take", "Substitution", "Imperative", "Pattern interrupt", etc.)
- **The variation** (ready-to-publish caption, 15-35 words for IG Reel format)
- **"Why this works"** explanation (1-2 lines)
- **"Insert to board"** action button per card
- **"Save all to board →"** at section header

### Multi-pane shell (when boost fires from Discover)
The result opens in the **right pane** while Discover stays in the LEFT pane (matches our Phase 11 design but Eden does it automatically on boost click).

### Our gaps
- No `showBoostVariations` tool implementation
- No "Variations / Insert to board / Save all to board" card UI
- Boost from a post in Discover doesn't auto-open a side pane (it navigates to /chats/<id> instead)

---

## Screen 8 — Chat (new, empty)

```
┌──────────────────────────────────────────────────────────┐
│ New chat ⌄                                       ⊕ ▤    │
│                                                          │
│                                                          │
│              ✨ What story are we telling?              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ⊕ Select board items, @ mention creators, or /   │   │
│  │   for voices…                       Eve Max ⌄ 🎤↑│   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│       Recent              Boosts                         │
│       💬 Remix "..."  9h  ▤ Content Breakdown      →    │
│       💬 Build a voice 9h  🧠 Thinking Partner      →    │
│                            🧭 Start Writing         →    │
│                            🎯 Grade My Content      →    │
│                            🔥 Niche Playbook        →    │
└──────────────────────────────────────────────────────────┘
```

Headline rotates: "What story are we telling?" / "What are we shipping today?" / etc.

### Chat input components (5 elements)
1. **⊕** Plus button — attach board items / paste link
2. **Text area** with composite placeholder
3. **Eve Max ⌄** — voice selector (TTS voice for replies — NOT user's voice profile)
4. **🎤** — mic for voice input (Whisper transcription)
5. **↑** — send

### Boost starters (5 chat-tab presets)
- ▤ **Content Breakdown** — "Reverse-engineer why a piece of content works"
- 🧠 **Thinking Partner** — "Refine and deepen an idea through structured dialogue"  
- 🧭 **Start Writing** — "Find what to write, sharpen the angle, and scaffold the piece"
- 🎯 **Grade My Content** — "Grade your draft, then sharpen the moves that matter most"
- 🔥 **Niche Playbook** — "Surface what's hitting in a niche, then ideate spinoffs"

### Eve Max voice
Not the user's voice profile. This is the **TTS voice for assistant replies** (like ElevenLabs voice picker). Other options likely include other ElevenLabs voices.

---

## Screen 9 — Chat with preset attached (mid-stream)

```
┌──────────────────────────────────────────────────────────┐
│ Help me think through an ide… ⌄                  ⊕ ▤    │
│                                                          │
│                  ┌──────────────────────────────┐        │
│                  │ 🧠 Thinking Partner          │        │
│                  │ Refine and deepen an idea…   │        │
│                  └──────────────────────────────┘        │
│                                                          │
│                 Chasing the thread                       │
│                                                          │
│ ▾ Thoughts                                               │
│                                                          │
│ I'm ready. What's the idea?                              │
│                                                          │
│ If it helps, you can type or paste it directly here,     │
│ @ mention any board item (draft, note, link, transcript) │
│ to drop it into the conversation, or attach anything     │
│ that gives texture to what you're working on.            │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Type or @ the idea you want to think through…   │   │
│  │                                     Eve Max ⌄ 🎤↑│   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Title patterns
- For boost presets: chat title = `triggerMessage` first ~40 chars (e.g. "Help me think through an i…")
- For post-level boosts: `"Remix '<post caption first 30 chars>...'"`

### Status messages during stream
- "Chasing the thread"
- "Connecting the dots"
- "Threading the needle"
- "Pulling at the thread"
- (Rotating, probably random — humanizes the wait)

### Top right
- ⊕ — fork chat / new variant
- ▤ — open in workspace pane (we have this as ⌥ in our impl)

---

## Screen 10 — Boards canvas (free-form)

```
┌──────────────────────────────────────────────────────────┐
│ AI Inspo ✚                              Chat  Share  ⚙  │
├──────────────────────────────────────────────────────────┤
│  ● All     ● AI Carousels                                │
│                                                          │
│  ┌────────────────────┐  ┌──────────────────────────┐   │
│  │ [embedded post:    │  │ hq.digital ✓             │   │
│  │  Ashok Reddy IG    │  │ View profile             │   │
│  │  grid - 9 photos]  │  │                          │   │
│  │                    │  │ Meet the Higgsfield      │   │
│  │                    │  │ Supercomputer            │   │
│  │                    │  │ [carousel — 4 pages]    │   │
│  │                    │  │                          │   │
│  │                    │  │ "One chat. Every format..│   │
│  │                    │  │  And it just got…"       │   │
│  │                    │  │                          │   │
│  │                    │  │ View more on Instagram   │   │
│  │                    │  │ 21 likes   hq.digital    │   │
│  │                    │  │ Higgsfield launched the…│   │
│  └────────────────────┘  └──────────────────────────┘   │
│                                                          │
│  (free-form positioning — drag, resize, zoom)            │
└──────────────────────────────────────────────────────────┘
```

### Key UI elements
- **Title + ✚** at top (board name + add new item)
- **Sub-tag tabs** with colored dot indicators (All · AI Carousels · …)
- **Chat / Share / Settings** in top right (Chat = chat with this board as context)
- **Items rendered as full embedded social post cards** — IG carousels paginated with dots, full captions, like counts, bookmark icons. NOT generic file tiles.
- **Pan/zoom infinite canvas** — drag to pan, scroll to zoom

### Backend
- `GET /workspaces/<ws>/blob` → records with `x, y, parentId, itemType, title, searchText`
- `POST /workspaces/<ws>/search/records` for lookup by itemIds
- Camera state cached in `localStorage[canvas-camera-cache:v1:<ws>:<spaceId>]`

### Our gaps
- Our boards are a basic grid; Eden is a **free-form infinite canvas**
- Post items render as MINIMAL tiles in our impl; Eden renders FULL IG-style embeds
- No sub-tag tabs in our impl
- No "Chat with this board" top-right button
- No "Share" (public board link) flow
- No drag-resize-reposition

---

## Screen 11 — Workspace switcher footer (dropdown)

```
┌─────────────────────────┐
│ M My workspace          │
├─────────────────────────┤
│ ⚙ Settings              │
│ 💳 Billing              │
│ → Sign out              │
└─────────────────────────┘
```

### Our gaps
- We just have a name display; Eden has actions: Settings, Billing, Sign out
- No multi-workspace switching shown (single workspace user)

---

## Screen 12 — Creators tab (Discover → Creators)

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 Search for a handle or paste a profile URL    All ⌄   │
├──────────────────────────────────────────────────────────┤
│ Discover  Creators  My Lists                              │
│                                                          │
│ ⊙ DAN KOE        @thedankoe                              │
│   Building eden.                                         │
│   👥 307K     # 304                                       │
│                                                          │
│ ⊙ Alex Hormozi   @alexhormozi                            │
│   I invest and scale companies at Acquisition.com       │
│   👥 73K      # 1                                         │
│                                                          │
│ ⊙ Dan Koe        @thedankoe                              │
│   Building Eden — the best place to find proven ideas… │
│   👥 178K     # 1.4K                                      │
│                                                          │
│ ⊙ Sahil Bloom    @sahilbloom                             │
│ ⊙ Mark Manson    @markmanson                             │
│ ⊙ Gurwinder      @gurwinder                              │
│ ⊙ Tim Denning    @timdenning                             │
│ ⊙ Ryan Holiday   @ryanholiday                            │
│ …                                                        │
└──────────────────────────────────────────────────────────┘
```

### Default state (empty search)
- Shows **`/creators/top`** results — Eden's pre-curated top-creators list
- Per-creator row: avatar, displayName, @username, bio (truncated), 👥 follower count, # post count

### Searching a URL
- Real-time `POST /profiles/resolve` as you type/paste
- Shows resolved profile inline with "+ Add to list" button

### Our gaps
- No "Search for a handle or paste a profile URL" universal input
- No "top creators to follow" default state
- We have separate "platform + handle" inputs; Eden has one smart URL field

---

## Screen 13 — Creator detail page

```
┌──────────────────────────────────────────────────────────┐
│ ← @levelsio                                              │
├──────────────────────────────────────────────────────────┤
│ ⊙ @levelsio  @levelsio              + Add to list  ↗ Open│
│   📷https://t.co/lAyoqmSBRX $100K/m                      │
│   🛰https://t.co/ZHSvI2wjyW $44K/m                       │
│   …                                                      │
│   👥 883K followers · # 1.3K posts cached                │
│   ⚡ 694 typical likes · ✓ all caught up                  │
│                                                          │
│ 🔍 Search posts…                              All time ⌄│
│                                                          │
│ Recent  Top liked  Top viewed  Top outlier              │
│                                                          │
│ [grid of @levelsio's posts, each with ⚡, 👁, ❤, etc.]  │
└──────────────────────────────────────────────────────────┘
```

### Key UI
- Back arrow
- Creator card: avatar, @handle, full bio (multiline), follower count, posts cached count, **typical likes** (= `outlierBaselines.median`), sync state ("all caught up")
- "+ Add to list" CTA, "↗ Open" external link
- Per-post-list search bar
- 4 sort tabs

### Our gaps
- We have a similar page; ours is rougher
- "typical likes" / "typical reel views" not shown in our impl
- No "all caught up" sync state badge

---

## Screen 14 — Build voice modal (3 options)

(Inferred from prior screenshots + bundle)

```
┌──────────────────────────────────────────────────────────┐
│ Build your voice                                      ✕  │
├──────────────────────────────────────────────────────────┤
│ Eden writes better when it knows how you sound. Three    │
│ ways to get started:                                     │
│                                                          │
│ ┌────────────────────────────────────────────────┐      │
│ │ 💬 Build via chat (~5 min)         RECOMMENDED  │      │
│ │ A guided conversation. Best signal.             │      │
│ └────────────────────────────────────────────────┘      │
│                                                          │
│ ┌────────────────────────────────────────────────┐      │
│ │ 🔗 Paste up to 5 links (~2 min)                 │      │
│ │ Substack posts, tweets, YouTube transcripts…   │      │
│ └────────────────────────────────────────────────┘      │
│                                                          │
│ ┌────────────────────────────────────────────────┐      │
│ │ ✦ Pick an archetype (~1 min)         FASTEST   │      │
│ │ 6 templates: Founder · Contrarian · Philosopher │      │
│ │ Operator · Educator · Creative                  │      │
│ └────────────────────────────────────────────────┘      │
│                                                          │
│ Say "update my voice" to refine it as you go.            │
└──────────────────────────────────────────────────────────┘
```

### Backend per option
- **Chat** → creates `chats` row with `context_kind=voice_build`, opens a Thinking-Partner-style conversation using the `Perspective Architect` system prompt
- **Links** → fetches 5 URLs, runs voice extraction via single Gemini call returning JSON
- **Archetype** → copies one of 6 archetype voice cards into user's voiceProfile

### Voice card schema (lives on `users.voiceProfile`)
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
  vocabulary:       string[],    // additional field referenced in Variations boost
  writingSamples:   string[],    // additional field
  version:          "v0" | "v1" | "v1.1" | …
}
```

With **carry-forward rule**: every save preserves prior fields verbatim, only adds/changes what new material warrants.

### Our gaps
- Modal shown in our app uses different copy + no archetype previews
- We don't have "Recommended" / "Fastest" badges
- Voice schema is simpler (we have only ~5 fields)

---

## Screen 15 — Voice library `/voice` (inferred)

Each voice row:
- Name, archetype, last updated, default badge
- "Use this voice" button per row
- "Refine" → opens chat to update

Detail page (`/voice/<id>`) — each section of the voice card editable as markdown.

---

## Screen 16 — My Lists tab (Discover → My Lists)

(Inferred — we didn't capture, but structurally:)
```
┌──────────────────────────────────────────────────────────┐
│ Discover  Creators  My Lists                              │
│                                                          │
│ ✨ For you            adaptive                            │
│    0 creators · Auto-curated from your interests        │
│                                                          │
│ ⊞ AI Creatives        curated                            │
│    1 creator · Updated 2d ago                            │
│                                                          │
│ + Create a list                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Screen 17 — @-mention popover in chat input

(Captured implicitly — Eden's chat input placeholder mentions "@" + "/" triggers.)

```
       ┌─────────────────────────────────────┐
       │ Items   Creators   Lists            │
       ├─────────────────────────────────────┤
       │ @migs.vis…  Migs Visuals            │
       │ @ashok…     Ashok Reddy             │
       │   instagram · 193K                  │
       ├─────────────────────────────────────┤
       │ ↕ navigate · ⏎ insert · Tab switch  │
       └─────────────────────────────────────┘
```

### Our gaps
- We already have this — match Eden's exact 3-tab structure (we do)

---

## Screen 18 — Settings (inferred)

Likely contains:
- Profile (display name, image)
- Voice profiles list
- Shortcut bindings
- Discord integration
- Email notifications (Loops.so)
- Theme

---

## Screen 19 — Billing page

(Captured via `GET /workspaces/<ws>/billing`)

```yaml
currentPlan: "Free trial"
seatCountUsed: 1
seatCountPurchased: 0

availablePlans:
  - Starter Monthly  $29/mo
  - Starter Annual   $299/yr ($24.92/mo)
  - Pro Monthly      $79/mo
  - Pro Annual       $790/yr ($65.83/mo)

# Three quota meters shown
- AI search    cap: 10/day
- Boosts       cap: 40/month
- Credits      cap: 300/month
```

---

# The complete UI replica execution plan

## Phase A — Visual polish that matches Eden exactly (1 week)

### A.1 — Sidebar (1 day)
- [ ] Match Eden's "Find or create ⌘K" pill (we have a similar one)
- [ ] Match exact section ordering: Find/Create, Home/Discover/Chat, Today (recent chats), Workspace (boards), Tools (legacy), footer
- [ ] **Workspace switcher with Settings/Billing/Sign out actions** (we just show the name)

### A.2 — Home (1 day)
- [ ] Add rotating headlines (we have 5, add: "What's on your mind?", "Welcome back.")
- [ ] Verify "Getting started" matches exact copy: "Build your voice / Create your first board / Use a boost / Add creators to a list"
- [ ] Right-side "Starter templates" column with 4 templates (we have)
- [ ] "My lists" section with `(All Following X)` `(<List Name> N)` filter pills
- [ ] 4 sort tabs: Recent, Top liked, Top viewed, Top outlier
- [ ] Platform dropdown on Home (we have on Discover only)

### A.3 — Discover top nav + chips + utility icons (1 day)
- [ ] **Move sort/filter** to ONE filter pill like "All · Last 3 months · 10x" instead of separate controls
- [ ] Pillar chips with **icons + colors** (◆ ✦ □ ❤ ⊞ ♨) — currently we have plain text chips
- [ ] **+ Add pillar** dialog with full taxonomy tree
- [ ] **3 utility icons** top-right: hide-seen (🚫), hide-images (🖼), refresh (↻)

### A.4 — Post card hover state (1 day)
- [ ] Match Eden's hover treatment (subtle lift + border)
- [ ] Add **post stats row** with the same layout: outlier pill + view/like/comment icons inline
- [ ] Bookmark icon to right of stats (we have ⊕ save button)
- [ ] Platform badge in top-right of thumbnail (we have)

### A.5 — Cmd+K palette (1 day)
- [ ] Actions section with **7 keyboard shortcuts** (B, F, D, ⇧C, P, ⌘/, C)
- [ ] Recent section above results
- [ ] Footer with `side peek` and `duplicate` shortcuts

### A.6 — Loading skeletons + page-fade animations (½ day)
- [ ] Confirm we match Eden's skeleton style (we already have skeletons)
- [ ] Add the "Chasing the thread / Connecting the dots / …" rotating chat status messages

## Phase B — Critical missing features (2 weeks)

### B.1 — Post detail modal (3 days)
- [ ] Build full-screen post modal with platform-style embed (IG-grid for carousel, video player for reels)
- [ ] 4-icon action bar: ⚡ Boost · 🚫 Hide · ⊕ Save · 🔗 Share + ✕ Close
- [ ] Stats row: outlier + views + likes + comments + engagement rate
- [ ] Caption section with Copy button
- [ ] Transcript section (collapsible)
- [ ] **Vision Analysis section** rendering `enrichment.aiOverview.blocks` (hook, pullQuotes, etc.)

### B.2 — Post-boost menu (4 boosts + 2 conditional) (3 days)
- [ ] Add `lib/post-boost-presets.ts` with 6 presets:
  - `variations` / "Discover Remix Boost mode" — variations with `showBoostVariations` tool
  - `expand-longform`
  - `reverse-engineer` (alias of content-breakdown)
  - `replicate`
  - `headline-variations` (conditional on long-video)
  - `break-into-post-ideas` (conditional on long-form)
- [ ] **Footer counter "Boosts this month: X of 40"**
- [ ] Per-preset system prompts (extract verbatim from `eden-deep-dive.md`)
- [ ] Auto-generate user message with full post markdown (Author, Platform, Format, Link, Post, Transcript)

### B.3 — `showBoostVariations` tool output rendering (2 days)
- [ ] Tool-call schema: `{variations: [{label, body, why}]}`
- [ ] Per-variation card UI: label header, multi-line body, "why this works" footer, "Insert to board" button
- [ ] Section header: "Variations" + "Save all to board →"

### B.4 — AI enrichment pipeline (3 days)
- [ ] On every `creator_posts` insert, queue a Gemini job that fills in:
  - `taxonomy_id` (3-tier `ext:tier1__tier2__tier3`)
  - `media_format` (short_video / long_video / image / carousel / article)
  - `mood`, `ai_tags`, `ai_description`
  - `ai_overview.blocks` with `{type, mechanic, openingLine, why, items, tone}`
- [ ] Cache forever, never re-enrich unless platform metrics change ≥X%

### B.5 — Social-mirror CDN (2 days)
- [ ] Supabase Storage bucket `social-mirror`
- [ ] Background worker: on ingest, download thumbnail + avatar, re-upload as `<platform>/<pk>/thumbnail.jpg` and `<platform>/profiles/<pk>/avatar-<sha256>.jpg`
- [ ] Update `creator_posts.thumbnail_url` to point at our CDN
- [ ] Update `creators.avatar_url` with content-hashed filename

### B.6 — Three-meter quota system (2 days)
- [ ] `search_usage(workspace_id, count_today, reset_at)` — daily, cap 10
- [ ] `boost_usage(workspace_id, count_this_month, reset_at)` — monthly, cap 40
- [ ] `workspace_credits(workspace_id, period_allowance, period_used, reset_at)` — monthly, default 300
- [ ] Each chat response burns 1 credit (tagged by surface)

## Phase C — Backend depth + replica fidelity (3 weeks)

### C.1 — Pareto outlier baselines per creator (3 days)
- [ ] Per-creator, per-segment (reel/post/default), per-metric (views/likes), 30-post window
- [ ] Compute `tau / median / mInfinity` on every metrics refresh
- [ ] Per-platform `tau` constants: IG 0.25, Twitter 0.417, LinkedIn TBD
- [ ] Display "typical X" using `median` value

### C.2 — Pillar taxonomy with `ext:` hierarchy (1 day)
- [ ] Seed top-level: Productivity, Self-improvement, Business, Health & fitness, Content creation, Psychology
- [ ] 3-tier scheme: `ext:t1__t2__t3`
- [ ] Workspace-pinned set via `pillars` table; PATCH endpoint
- [ ] Auto-create adaptive "For you" list (✨, kind="adaptive", position=-1000) when first pillar pinned

### C.3 — Typesense cross-platform Discover (1 week)
- [ ] Docker compose with Typesense locally
- [ ] Schema: collection `content` with fields matching the post schema, with vector field
- [ ] Ingest pipeline: on creator_posts insert/update, push to Typesense
- [ ] `/api/discover` route reads Typesense via `typesense-hybrid` (BM25 + vector)
- [ ] **Two-stage relaxation**: strict pass → outlier-gte-5 fallback
- [ ] Per-platform pool sizes: 80 each, then rerank
- [ ] Diagnostics in response: `searchPath`, `quotas`, `poolSizes`, `relaxation.stages`

### C.4 — Interaction events + personalization (1 week)
- [ ] `post_events(workspace_id, content_id, creator_id, event_type, dwell_ms, position, surface, occurred_at)`
- [ ] Batched POST endpoint accepting ≤20 events at once
- [ ] Client-side: IntersectionObserver fires `view` + `dwell` events
- [ ] After **8+ signals**, compute workspace profile embedding (avg of viewed-post embeddings)
- [ ] Use it for ANN reranking via Typesense vector field
- [ ] Diagnostics: `personalization.eligible`, `signalWeight`, `annPoolSize`, `annPoolMerged`, `threshold: 8`

### C.5 — DeepSeek V4 via OpenRouter + max-mode toggle (1 day)
- [ ] Add `OPENROUTER_API_KEY` to env
- [ ] Route chats through OpenRouter using `deepseek/deepseek-v4-pro`
- [ ] `mode: "regular" | "max"` flag — regular routes DeepSeek, max could route DeepSeek with extended reasoning OR Gemini Pro
- [ ] **SSE reasoning events** in our streaming: emit `reasoning-start`, `reasoning-delta`, then `text-delta` (currently we just stream `token`)
- [ ] Chat "Thoughts" collapsible UI section maps to reasoning events

### C.6 — Voice card v0/v1 versioning (2 days)
- [ ] Store `voice_profile JSON` + `voice_profile_history JSON[]` on users (or on `voices` table)
- [ ] Carry-forward rule: every save copies prior fields verbatim, only delta
- [ ] "Ship v0 save card early" — Voice Builder posts a v0 card after 2-3 turns, refines to v1
- [ ] Schema fields: personality, audience, anchorStories, formatScaffolds, toneTags, rhythm, formatHabits, prefer, avoid, notes, vocabulary, writingSamples

## Phase D — Polish (1 week)

### D.1 — Boards as infinite canvas (4 days)
- [ ] Replace grid with pan/zoom canvas using `react-flow` or `tldraw`
- [ ] Items rendered as **full platform embeds** (IG carousel, X embed, YT embed)
- [ ] Drag-resize-reposition with `(x, y, w, h)` persisted to board_items table
- [ ] Sub-tag tabs at top of board (`All / AI Carousels / …`) with colored dots
- [ ] Per-item tag stored on `board_items.tag`
- [ ] Top-right: Chat (with this board), Share (public link), Settings

### D.2 — Mic + Eve Max TTS (3 days)
- [ ] Mic button → Whisper transcription via OpenAI or Groq
- [ ] Eve Max picker → ElevenLabs TTS voice selection
- [ ] Stream TTS in parallel with text output
- [ ] User preference: default voice + auto-play toggle

### D.3 — Side-peek + duplicate on Cmd+K (1 day)
- [ ] `⌥+⏎` opens hit in workspace pane
- [ ] `⌘D` duplicates the item

### D.4 — Onboarding social scan (1 day)
- [ ] After onboarding form, kick off background `/api/profiles/analyze` per provided handle
- [ ] By the time user lands on Home, their Discover feed has data

---

# Verification checklist (every Eden screen → our equivalent)

| Eden | Our route | Status |
|---|---|---|
| Home | `/` | ✅ exists, needs A.2 |
| Cmd+K palette | (modal) | ⚠ basic, needs A.5 |
| Discover (open) | `/discover` | ⚠ exists, needs A.3 |
| Discover (filter popover) | (popover) | ⚠ basic, redo A.3 |
| Post detail modal | (modal) | ❌ missing → B.1 |
| Post boost menu | (popover) | ❌ missing → B.2 |
| Boost output (Variations) | (chat) | ❌ no tool render → B.3 |
| Chat (new, empty) | `/chat` | ✅ exists |
| Chat with preset | `/chats/[id]` | ✅ exists |
| Board canvas | `/boards/[id]` | ⚠ grid not canvas → D.1 |
| Workspace switcher | (footer) | ⚠ no actions → A.1 |
| Creators tab | `/creators` | ✅ exists |
| Creator detail | `/creators/[platform]/[handle]` | ✅ exists |
| Build voice modal | (modal) | ⚠ basic → A.2 |
| Voice library | `/voice` | ✅ exists |
| My Lists tab | `/creators` (3rd tab) | ⚠ missing → A.3 |
| @ mention popup | (inline) | ✅ exists |
| Settings | `/settings` | ❌ missing |
| Billing | `/billing` | ❌ missing |

**Legend:** ✅ matches Eden · ⚠ exists but rough · ❌ missing entirely

---

# Estimated time to exact replica

| Phase | Effort |
|---|---|
| A — Visual polish | 1 week |
| B — Critical missing features | 2 weeks |
| C — Backend depth | 3 weeks |
| D — Polish | 1 week |
| **Total** | **~7 weeks** |

Realistic given solo developer + you already have ~70% of the foundation.

The **single biggest unlock** in our codebase is **B.4 (AI enrichment pipeline)** — once every post has `aiOverview.blocks`, almost every other feature gets dramatically richer (boosts, hover previews, search, sort).
