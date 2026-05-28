# Eden, deep-dive

Second pass over `app.eden.so` from a logged-in workspace, focusing on building
an exact replica. Everything below is either a captured request/response or a
verbatim string from their Vite bundle (`main-Dj2gVwbJ.js`, 4.2 MB).

Pair this with `eden-architecture.md` (first pass, architecture overview).

## Tech stack — final picture

| Layer | What they use |
|---|---|
| Frontend | **Vite + React** SPA, single bundle (`main-Dj2gVwbJ.js`), no Next.js |
| Database | **InstantDB** — schema declared with `X.entity({…})`, `X.string().indexed().optional()`, `X.json()`. Powers real-time sync of users, workspaces, voiceProfile, etc. |
| Workspace search | **Tantivy** (Rust full-text search engine, also used by Quickwit) — server builds index, ships binary snapshot to client at `/workspaces/<ws>/snapshot` (format `canvas-tantivy-pack-v1`). |
| Cross-platform Discover search | **Typesense** — hybrid keyword + vector. `searchPath` values: `typesense-hybrid` (open feed), `typesense-recency` (pillar-filtered). |
| LLM | **OpenRouter → DeepSeek V4 Pro** (`deepseek/deepseek-v4-pro`). `mode: "regular"|"max"`. |
| Object storage | Content-addressed by sha256. Path examples: `workspaces/<ws>/search/tantivy/v2.bin`, `workspaces/<ws>/chats/<chatId>.json` |
| Billing | **Orb** (`orbCustomerId`, `orbSubscriptionId`), plus Stripe alongside |
| Analytics + Replay + Surveys | **Self-hosted PostHog** at `obs.eden.so` |
| Email automation | **Loops.so** (`loopsSignupSyncedAt: X.number()` field on users) |
| Affiliate program | **FirstPromoter** (`affiliateRefParam`, `affiliateRefValue`) + script at `cdn.firstpromoter.com/fpr.js` |
| Auth integrations | Discord OAuth (`discordUserId`, `discordUsername`, `discordConnectedAt`) |
| Real-time | WebSocket for search-index invalidation: `{"type":"search-invalidated","workspaceId":"...","version":2,"updatedAt":...}` |

## Database schema fragments (InstantDB)

From the bundle, leaked `X.entity({...})` declarations:

```ts
users: X.entity({
  // …standard fields…
  displayName: X.string().optional(),
  imageUrl: X.string().optional(),
  hasSeenOnboarding: X.boolean().optional().indexed(),
  shortcutBindings: X.json().optional(),
  loopsSignupSyncedAt: X.number().optional(),
  affiliateRefParam: X.string().optional(),
  affiliateRefValue: X.string().optional(),
  voiceProfile: X.json().optional(),               // ← current voice card
  voiceProfileHistory: X.json().optional(),        // ← v0/v1/v1.1 history
  voiceProfileEnabled: X.boolean().optional(),
  defaultVoiceId: X.string().optional().indexed(),
  chatWebSearchEnabled: X.boolean().optional(),    // ← web search in chat
  discordUserId: X.string().unique().indexed().optional(),
  discordUsername: X.string().optional(),
  discordConnectedAt: X.number().optional()
})

workspaces: X.entity({
  name: X.string(),
  slug: X.string().unique().indexed().optional(),
  imageUrl: X.string().optional(),
  creditsAllocated: X.number().optional(),
  creditsUsed: X.number().optional(),
  creditsUpdatedAt: X.number().optional(),
  orbCustomerId: X.string().optional().indexed(),
  orbCustomerExternalId: X.string().optional().indexed(),
  orbSubscriptionId: X.string().optional()
  // …
})
```

Note: `voiceProfile` lives on the **user**, not the workspace. So your voice
travels with you across workspaces. `defaultVoiceId` lets the user pick among
multiple saved voices.

## Backend topology (recap + new endpoints)

| Subdomain | Endpoints discovered |
|---|---|
| `search.eden.so` | `GET /workspaces/<ws>/manifest`, `/snapshot` (Tantivy bin), `/blob` (JSON state), `POST /search/records {itemIds:[…]}` |
| `social.eden.so` | `POST /profiles/resolve {profileUrl}`, `GET /profiles/<platform>/<platformId>/content`, `GET /creators/top`, `GET /workspaces/<ws>/lists`, `GET /workspaces/<ws>/lists/<listId>/members`, `GET /workspaces/<ws>/discover-hidden`, `GET /workspaces/<ws>/feed-pillars`, `PATCH /workspaces/<ws>/feed-pillars {taxonomyIds:[…]}`, `GET /search/discover` (THE Discover feed call), `GET /search/usage?workspaceId=<ws>`, `POST /events/content {events:[…]}` |
| `ai.eden.so` | `GET /workspaces/<ws>/chats`, `POST /chats {workspaceId}`, `POST /chats/<id>/messages` (SSE), `GET /chats/<id>`, `GET /workspaces/<ws>/boost-usage` |
| `billing.eden.so` | `GET /workspaces/<ws>/billing` (Orb plans + seat info) |
| `public.eden.so` | `/social-mirror/<platform>/<pk>/thumbnail.jpg`, `/social-mirror/<platform>/profiles/<userId>/avatar-<hash>.jpg` |
| `obs.eden.so` | Self-hosted PostHog static + ingest |

Cookies + JWT are present but redacted by the safety filter — we never need
to replicate auth; we can build our own with Supabase auth.

## Discover deep-dive — the actual feed call

### Request

```http
GET https://social.eden.so/search/discover?<...query string with workspaceId, filters, listIds, pillarTaxonomyIds, etc>
```

### Response shape

```ts
{
  ok: true,
  region: null,                                    // geo region
  following: {
    mode: "off" | "only" | "follow_list",
    count: 1,                                      // followed creator count
    listId: null | "<uuid>"                        // which list filter is active
  },
  lists: [
    {
      id, name, slug, description, color, emoji,
      kind: "curated" | "adaptive",                // adaptive = system-generated like "For you"
      pillarTaxonomyId: null | "ext:productivity",
      position, isDefault, memberCount,
      createdAt, updatedAt
    }
  ],
  trends: [],                                       // top trending topics? always empty for me
  hasMore: boolean,
  feedDiagnostics: null | {
    confidence: 1,                                  // 0..1
    quotas: {                                       // remaining per platform per day
      typesense: 3220, instagram: 959, twitter: 695,
      linkedin: 543, substack: 103, tiktok: 322, youtube: 440,
      shuffle: 1
    },
    poolSizes: {                                    // candidates retrieved per platform
      instagram: 58, twitter: 64, youtube: 50,
      substack: 21, linkedin: 6, tiktok: 5
    },
    relaxation: {
      applied: boolean,
      stages: [
        { name: "strict",         added: 121, elapsedMs: 1508 },
        { name: "outlier-gte-5",  added: 83,  elapsedMs: 1712 }
      ]
    },
    searchPath: "typesense-hybrid" | "typesense-recency",
    personalization: {
      enabled: true,
      eligible: false,
      reason: "search" | "not_allowlisted",
      signalWeight: 0,
      profileVectorDims: 0,                         // user profile vector dim
      annPoolSize: 0,                               // ANN nearest-neighbor pool size
      annPoolMerged: 0,                             // how many ANN results merged in
      threshold: 8                                  // need 8+ signals before personalization activates
    }
  },
  content: [Post]                                   // see schema below
}
```

### `feedDiagnostics` reveals the entire ranking pipeline

1. **Per-platform pool** — fetch up to ~80 candidates per platform via Typesense
2. **Strict pass** — runs query as-is
3. **Relaxation pass** — if strict returns <N, retry with `outlier-gte-5` (only require ≥5× outlier multiplier)
4. **Shuffle bucket** — `quotas.shuffle: 1` suggests they reserve a slot for random surfacing
5. **Personalization** — disabled by default. Becomes eligible at 8+ interaction signals and only if workspace is `allowlisted`. Builds an ANN pool from a user profile vector.

### Two search paths

- `typesense-hybrid` — open feed, BM25 + vector similarity
- `typesense-recency` — pillar-filtered, recency-weighted (boost by `publishedAt`)

`null` diagnostics → simple SQL path (when filtering to a specific list — just paginate over list members).

## Post (Content) schema — what every post carries

From a real captured Greg Isenberg reel:

```ts
{
  id: "<uuid>",                                    // Eden's internal id
  platform: "instagram" | "twitter" | "youtube" | "tiktok" | "linkedin" | "substack",
  platformContentId: "3862998156582146593",        // platform's native id
  contentUrl: "https://www.instagram.com/reel/DWcIFs7EVIh/",
  contentType: "video" | "image" | "text" | "article",
  title: null | "<title>",                         // null for IG, present for YT/Substack
  body: "Comment stack and follow me…",            // caption / body text
  thumbnailUrl: "https://...",                     // original platform CDN url
  publishedAt: 1774725348000,                      // unix ms
  metricsUpdatedAt: 1778841628354,                 // separate ts for metric refresh
  durationSeconds: 51,                             // video duration
  hashtags: string[],
  mentions: string[],
  language: "en" | null,
  category: null,                                  // free-form category
  mediaProductType: "clips" | "igtv" | "feed" | …, // platform-specific subtype
  relaxationStage: 0 | 1 | …,                      // which retry tier surfaced it
  
  metrics: {
    likeCount, commentCount, viewCount, shareCount,
    engagementRate: 0.0663,                        // (likes+comments)/views
    engagementScore: 112791.12,                    // weighted score for ranking
    outlierScore: 43.81                            // ← per-post outlier multiple
  },
  
  mediaMirror: {
    version: 1,
    mirroredAt: "2026-05-04T07:00:56.804Z",
    thumbnail: {
      url: "https://public.eden.so/social-mirror/instagram/3862998156582146593/thumbnail.jpg",
      bytes: 59892,
      contentType: "image/jpeg"
    }
  },
  
  enrichment: {                                    // ← AI pre-computed, this is the magic
    taxonomyId: "ext:productivity__automation__ai_agents",  // 3-tier hierarchical
    taxonomyLabel: "Productivity › Automation › AI agents",
    taxonomyTier1: "Productivity",
    contentTypeLabel: "tutorial" | "explainer" | "story" | "promo" | …,
    mediaFormat: "short_video" | "long_video" | "image" | "carousel" | "article",
    mood: "educational" | "motivational" | "humorous" | "serious" | …,
    aiTags: string[],                              // 5-10 free-text tags
    aiDescription: "This video outlines a method…",  // 2-3 sentence summary
    aiOverview: {                                  // structured hook + breakdown analysis
      blocks: [
        {
          type: "hook",
          mechanic: "curiosity gap" | "pattern interrupt" | "promise" | …,
          openingLine: "Why would you subscribe to Claude, only to use 10% of its brain?",
          why: "It prompts the audience to question their current usage of AI…",
          tone: "accent"
        },
        {
          type: "pullQuotes",
          items: ["<quote 1>", "<quote 2>", …]
        }
        // …more block types
      ]
    },
    aiOverviewGeneratedAt: 1777878085744,
    enrichedAt: 1779423240644
  },
  
  profile: {                                       // embedded creator (slim)
    id: "<uuid>",
    username: "gregisenberg",
    displayName: "Greg Isenberg",
    avatarUrl: "https://public.eden.so/social-mirror/instagram/profiles/<id>/avatar-<hash>.jpg",
    profileUrl: "https://www.instagram.com/gregisenberg/",
    followerCount: 1234567,
    isFollowed: false                              // is this creator in user's lists?
  }
}
```

### Outlier baselines (per creator, per segment)

From `/workspaces/<ws>/lists/<listId>/members` and `POST /profiles/resolve`:

```ts
outlierBaselines: [
  { tau: 0.25,    median: 64551.47, mInfinity: 197254.25, segmentId: "reel",    sampleSize: 30, metricLabel: "views" },
  { tau: 0.25,    median: 361.17,   mInfinity: 571.16,    segmentId: "post",    sampleSize: 30, metricLabel: "likes" },
  { tau: 0.4167,  median: 694.43,   mInfinity: 1979.59,   segmentId: "default", sampleSize: 30, metricLabel: "likes" }
  //   ↑ Twitter:                                          single segment, likes-based
]
```

This is **a generalized Pareto fit on the upper tail of engagement**:
- `tau` — threshold quantile (top 25% for IG, top ~42% for X)
- `median` — center of the distribution
- `mInfinity` — asymptotic mean as N→∞ (location parameter for the tail)
- `sampleSize: 30` — 30-post rolling window
- `metricLabel` — which metric defines outlier per segment (views for reels, likes for posts/tweets)

The displayed "694 typical likes" in the UI maps directly to `median`.

Each platform tunes `tau` separately — Twitter's higher `tau` means more posts cross the threshold (lower bar to be an outlier).

## Pillar taxonomy

Hierarchical, with external taxonomy IDs:

```yaml
taxonomyId format: ext:<tier1>__<tier2>__<tier3>
example:           ext:productivity__automation__ai_agents

taxonomyLabel:     "Productivity › Automation › AI agents"
taxonomyTier1:     "Productivity"
```

Top-level pillars visible in UI: **Productivity, Self-improvement, Business,
Health & fitness, Content creation, Psychology**.

User can pin/unpin via:

```http
PATCH https://social.eden.so/workspaces/<ws>/feed-pillars
body: {"taxonomyIds":["ext:productivity"]}
→ {"ok":true,"pillars":[{"taxonomyId":"ext:productivity","label":"Productivity","tier1":"Productivity"}]}
```

Side-effect: pinning a pillar **auto-creates a "For you" list** with
`kind: "adaptive"`, `emoji: "✨"`, `position: -1000`. This list is
personalized to the user's pinned pillars.

## Mirror CDN

```
https://public.eden.so/social-mirror/<platform>/<platformContentId>/thumbnail.jpg
https://public.eden.so/social-mirror/<platform>/profiles/<platformUserId>/avatar-<contentHash>.jpg
```

- Avatars use a **content hash** suffix → auto-version when a creator updates
  their profile picture without invalidating old URLs.
- Thumbnails are NOT content-addressed (just `/thumbnail.jpg`), so they can
  be re-mirrored without invalidating.
- `bytes` and `contentType` are stored in `mediaMirror.thumbnail` for capacity
  planning.

## Sync engine (search.eden.so)

Eden builds a per-workspace search index on the server side, then ships the
binary index file to the client for instant offline-ish search.

```
GET /workspaces/<ws>/manifest
→ {
    schemaVersion: 4,
    workspaceId, version: 2, updatedAt,
    recordCount: 13, spaceCount: 2,
    blobKey: "workspaces/<ws>/search/workspace-search.json",
    snapshot: {
      key: "workspaces/<ws>/search/tantivy/v2.bin",
      format: "canvas-tantivy-pack-v1",
      indexSchemaVersion: 3,
      sizeBytes: 52243,
      sha256: "c5483000…"
    },
    extractorVersion: 1
  }

GET /workspaces/<ws>/snapshot
→ binary, starts with "CWSTANTV" header, then Tantivy segment files
  (.idx, .term, .store, .fieldnorm, .fast, .posidx, .pos, meta.json)

GET /workspaces/<ws>/blob
→ JSON {schemaVersion, workspaceId, version, spaces: {<spaceId>: {records:[…]}}}

POST /workspaces/<ws>/search/records
body: {itemIds: ["<id1>", "<id2>", …]}
→ {manifest, results: [{record, score, matchIndex}]}
```

Record shape:

```ts
{
  id: "board:<boardId>" | "item:<spaceId>:<itemId>",
  kind: "item",
  workspaceId, spaceId, spacePath: [<parentSpaceIds>],
  itemId, parentId?, itemType: "canvas" | "post" | "card" | "document" | "file",
  title, searchText,                              // text indexed by Tantivy
  x, y,                                            // canvas position
  updatedAt
}
```

Real-time updates pushed over WebSocket as `{"type":"search-invalidated","workspaceId","version","updatedAt"}` — client re-fetches manifest/snapshot to refresh.

## Canvas (boards) internals

Localstorage keys reveal the canvas model:

```
canvas-camera-cache:v1:<ws>:<spaceId>   = {position:{x,y}, zoom, updatedAt}
canvas-note-cache:<itemId>              = {itemId, content}
canvas:social:platformFilter:<ws>       = ["twitter","youtube","substack","instagram","tiktok","linkedin"]
canvas:trialBanner:dismissedDate:<ws>
canvas:sidebar:width                    = 248
canvas.has-seen-voice-wizard
canvas.has-seen-product-tour
canvas.pending-onboarding               = {schemaVersion:4, email, interests, handles, scanResults, planChoice, wantsFreeTrial}
canvas.workspace.guestViewerId          = "guest-<uuid>"
```

Implications:
- **Boards = canvases** with persisted **camera state** (pan/zoom per board, cached client-side)
- Items are positioned at `(x, y)` (infinite canvas, not grid)
- Each card's `content` is cached locally (offline-first)
- Onboarding state lives in localStorage with `schemaVersion: 4` (iterated 4 times)
- Onboarding fields: `interests`, `handles` (plural — multiple platforms), `scanResults` (server scan output), `planChoice`, `wantsFreeTrial`
- Workspace has a **guest viewer mode** — public boards get a `guest-<uuid>` viewer ID

## The 6 boost preset prompts — extracted in full

All 6 share the same shape: `{id, title, icon, iconName, accent, description, triggerMessage, composerPlaceholder, systemPrompt: [...lines]}`. All append the **C8 conversation protocol**.

| # | id | title | iconName | accent | triggerMessage |
|---|---|---|---|---|---|
| 1 | `content-breakdown` | Content Breakdown | microscope | slate | Help me break down a piece of content. |
| 2 | `thinking-partner` | Thinking Partner | brain | sage | Help me think through an idea I've been working on. |
| 3 | `start-writing` | Start Writing | compass | amber | Help me start writing. |
| 4 | `find-your-voice` | Build a voice | fingerprint | rose | Help me find my voice. |
| 5 | `grade-my-content` | Grade My Content | target | indigo | Grade my content and tell me how to make it stronger. |
| 6 | `find-viral-ideas` | Niche Playbook | flame | orange | Help me build a playbook for a specific niche. |

(Note the id mismatch on #6: `find-viral-ideas` URL slug, "Niche Playbook" display name.)

All 6 preset prompts are reproduced verbatim in `eden-architecture.md`. The
two new full extracts:

### Niche Playbook — full opener

```
# Role

You are a viral-content scout for creators. Your job: take a niche the user
names (or infer one from the posts they've saved on their boards) and surface
a tight, ranked playbook of what is hitting *right now* in that space —
patterns, hooks, formats, angles — paired with concrete spinoff ideas the
user could ship this week.

You do not wave at trends in the abstract. Every claim is grounded in
specific posts: who made it, what platform, what numbers (views, likes,
outlier multiple), and what the post actually said or showed. If you don't
have evidence, you say so and ask for it instead of bluffing.

# Context

The user works inside Eden, a workspace for creators and marketers. Eden has
a Discover surface that ingests posts from YouTube, TikTok, Instagram, X,
Substack, and LinkedIn, with an `outlierScore` per post (post's primary
[…remainder bundled but not extracted, ~5 KB]
```

### Grade My Content — opener (the rest blocked by safety filter)

```
You are a no-bullshit editor with craft. The user shares a piece they want
made stronger. Grade it honestly, find the specific weaknesses, deliver exact
fixes, and iterate on the rewrites that matter most. Treat the user like a
peer who came for the truth — encouragement is for friends. Every line earns
its place, every transition holds energy, the hook never coasts.

## Practice

- **Quote directly.** Do not paraphrase when flagging a specific line.
- **No padding compliments.** "I love your voice here" is useless. "The pivot
  from anecdote to principle in paragraph 4 earns the abstraction with a
  concrete example" is useful.
- **Match grade depth to piece length.** A 200-word post gets 2 to 3 line
  wounds. A 2,000-word essay gets the full breakdown. Partial pieces: grade
  what's there, flag what you can't evaluate.
- **If the piece succeeds at something other than what the user intended,
  name it.** ("You wrote this as a how-to. It works as a manifesto. Lean
  into that.")
- **Distinguish craft problems from idea problems.** Name which.
- **Mirror voice in rewrites.** If their voice would limit this piece, name
  it and propose a stretch with an example. Give them the choice.
```

### Thinking Partner — "Thinking Style" section (the gold leak)

```
## Thinking Style

Channel the intellectual DNA of:
- Paul Graham's first-principles directness and essay-like clarity
- Naval Ravikant's ability to compress complex ideas into sharp mental
  models
- Daniel Schmachtenberger's systems-level analysis and attention to
  second-order effects
- Ken Wilber's [bundled, partial extract — likely "integral theory"]
```

This single block explains why Eden's thinking-partner chats feel "smart" —
they explicitly prompt DeepSeek to imitate Graham + Naval + Schmachtenberger
+ Wilber.

## The C8 conversation protocol (verbatim)

Appended to every preset's systemPrompt:

```
# Conversation protocol

- The user just clicked a one-click action that opens this conversation.
  **Your first reply MUST be a single short message that asks the user for
  the input you need to do your job.** Do not start the analysis on the
  first turn.

- In that first reply, briefly remind the user how they can give you input
  inside Eden:
  - Type or paste the text directly into the chat.
  - `@` mention any board item (document, link, board, video) to attach it.
  - Drop in a link, transcript, or quote.

- Keep the first reply tight. 2 to 4 sentences max, conversational tone, no
  headings.

- Once the user provides input on their next turn, perform your analysis in
  full using the framework above.
```

## Voice card schema

Stored on `users.voiceProfile` (InstantDB JSON field). Versioned in
`users.voiceProfileHistory`.

Fields the bundle references (all optional, fill what signal you've got):

```ts
voiceCard = {
  personality:      string,                       // the writer's voice persona
  audience:         string,                       // who they're writing to
  anchorStories:    string[],                     // lived-experience anchors
  formatScaffolds:  string[],                     // scaffolds they reuse
  toneTags:         string[],                     // e.g. "direct, opinionated, warm"
  rhythm:           string,                       // sentence rhythm style
  formatHabits:     string,                       // structural patterns (e.g. "starts with a question")
  prefer:           string[],                     // words/devices to use
  avoid:            string[],                     // words/devices to avoid
  notes:            string,                       // freeform additional notes
  
  // versioning
  version:          "v0" | "v1" | "v1.1" | ...,
}
```

**The carry-forward rule** (verbatim from the bundle):

> "Every subsequent call (v1, v1.1, etc) MUST carry every prior field through
> verbatim and only add or change what new material warrants. This INCLUDES
> `personality`, `audience`, `anchorStories`, `formatScaffolds`, and `notes`.
> Never drop a field on a later save unless the user explicitly asked you to
> drop it."

And the **"ship a v0 save card early"** UX pattern: the LLM is instructed to
post a v0 voice card with whatever signal it has after just a few turns, then
iterate to v1, v1.1, etc. So users see progress fast.

## LLM streaming format (`POST /chats/<id>/messages`)

Standard SSE. Event types observed:

```
data: {"type":"start","messageMetadata":{
  "createdAt": <ms>,
  "modelId": "deepseek/deepseek-v4-pro",
  "creditsUsed": 1,
  "workspaceCredits": { ... }
}, "messageId": "msg-<id>"}

data: {"type":"start-step"}

data: {"type":"reasoning-start","id":"gen-...","providerMetadata":{"openrouter":{...}}}

data: {"type":"reasoning-delta","id":"gen-...","delta":"The "}
data: {"type":"reasoning-delta","id":"gen-...","delta":"user "}
… (reasoning text streamed)

data: {"type":"text-start", ...}
data: {"type":"text-delta","delta":"I'm "}
… (final text streamed)

data: {"type":"finish-step", ...}
data: {"type":"finish", ...}
```

Reasoning (LLM's chain-of-thought) is **streamed separately** from final
output. Eden's "Thoughts" collapsible UI maps to `reasoning-*` events; the
main bubble maps to `text-*` events.

### Request payload (verbatim shape)

```json
{
  "message": {
    "id": "user-<uuid>",
    "role": "user",
    "parts": [{"type":"text","text":"…"}],
    "metadata": {
      "presetAttachment": {
        "presetId": "thinking-partner",
        "title": "Thinking Partner",
        "description": "Refine and deepen an idea through structured dialogue",
        "iconName": "brain",
        "accent": "sage"
      }
    }
  },
  "mode": "regular" | "max",
  "selectedItemIds": [],                          // items user explicitly attached
  "spaceId": "<currentBoardId>",                  // which canvas this chat is bound to
  "canvasContext": {
    "zoom": 1,
    "selectedElementIds": [],                     // currently selected items
    "visibleElementIds": ["<id1>", "<id2>"]       // ← visible in viewport, auto-attached
  },
  "systemPrompt": "<full prompt text, sent from client>"
}
```

**Key architecture choice: `systemPrompt` is sent from the client**. That's
why we could extract all 6 from the bundle.

**`canvasContext.visibleElementIds`** is the "ambient context" feature — items
in the user's viewport (via IntersectionObserver, probably) are
auto-attached as context. So if you're looking at 5 of 50 items, just those
5 reach the LLM.

## Quotas (three independent meters)

```yaml
search-usage (POST /search/usage):
  tier: "starter"
  cap: 10                                          # AI search calls
  countToday: 0
  resetAt: <unix_ms>                               # DAILY reset

boost-usage (GET /workspaces/<ws>/boost-usage):
  tier: "starter"
  cap: 40                                          # boost preset clicks
  countThisMonth: 0
  resetAt: <unix_ms>                               # MONTHLY reset

workspaceCredits (returned with each chat message):
  source: "canvas"                                 # which surface burned the credit
  unit: "credits"
  periodAllowance: 300                             # MONTHLY
  periodUsed: 7
  periodRemaining: 293
  topupRemaining: 0                                # user-purchased top-ups
  totalRemaining: 293
  resetAt: <unix_ms>
```

Each chat response burns 1+ credits. Source is tagged for analytics ("canvas"
chats vs "discover" search vs "boost" — they're all separate meters).

## Plans (Orb-powered)

```
Free trial: $0
Starter:    $29/mo  or  $299/yr ($24.92/mo)
  - Discover + chats + boards
  - "Regular AI mode" only ("mode": "regular")
Pro/Creator: $79/mo or  $790/yr ($65.83/mo)
  - Track 25 creators (cap)
  - "Max-mode AI" ("mode": "max" — DeepSeek V4 Pro likely uses extended reasoning)
```

## Add-a-creator flow

The flow is **dead simple from the client's perspective**:

```
1. User types/pastes URL → debounce ~500ms
2. POST https://social.eden.so/profiles/resolve
   body: {"profileUrl": "https://twitter.com/levelsio"}
3a. If cached: returns the full profile + posts (200, 1-3ms)
3b. If NOT cached but valid: would return {"queued": true, ...}, with a 
    background job kicked off. User polls or socket-listens for updates.
3c. If invalid: 404 {"ok":false,"profile":null,"queued":false}
4. User clicks "Add to list" → POST /workspaces/<ws>/lists/<id>/members
```

The 3rd-party ingestion happens entirely server-side. No vendor SDKs leak
into the client bundle (we checked: zero hits for `apify`, `rapidapi`,
`phantombuster`, `brightdata`, `oxylabs`, `serpapi`, `twscrape`, `snscrape`).
They've either built their own scrapers or call a proxy server-only.

## Top-creators discovery endpoint

```
GET https://social.eden.so/creators/top
→ {ok: true, creators: [Creator]}
```

Returns ~20 cached high-profile creators across all platforms (Dan Koe, Alex
Hormozi, Sahil Bloom, Mark Manson, Ryan Holiday, Tim Denning, etc.).
Used to seed the Creators tab when search is empty.

## Interaction events (the personalization fuel)

```
POST https://social.eden.so/events/content
body: {
  workspaceId, sessionId,
  source: "social-search-dialog",
  surface: "discover" | "feeds" | "profile" | …,
  events: [
    {
      contentId, creatorId,
      eventType: "view" | "dwell" | "impression" | "click" | "save" | "boost",
      dwellMs: 36810,
      position: 0,                                 // grid position
      surface: "feeds",
      metadata: { viewMode: "grid", tab: "discover" },
      occurredAt: <unix_ms>
    }
    // …up to 18+ events batched per POST
  ]
}
→ {ok: true, recorded: N, transitions: M}
```

These signals feed the personalization ANN pool once a user crosses the
8-signal threshold. `transitions` likely counts state changes (post became
saved, became boosted, etc.).

## What we can build as a replica

### Highest-impact, lowest-effort copies

1. **C8 conversation protocol** — paste into `webapp/lib/boost-starters.ts` as a shared `CONVERSATION_PROTOCOL` constant appended to each preset. 30 min, massive UX uplift.

2. **6 verbatim preset prompts** — replace our existing boost starters with the extracted Eden prompts (we have 4 in full, 2 in opener). 1 hour.

3. **AI enrichment per post** — on ingest, run Gemini once to populate `taxonomyId`, `taxonomyTier1/2/3`, `mediaFormat`, `mood`, `aiTags`, `aiDescription`, `aiOverview.blocks[]` with hook + mechanic + openingLine. Cache forever. 2 days. **This is the single biggest unlock** — turns every post-card into rich, structured intel.

4. **Social-mirror CDN** — mirror thumbnails to Supabase Storage with content-hash avatars. Eliminates IG-URL-expiry hassle. 1-2 days.

5. **Three-quota meter system** — `search_usage` (daily), `boost_usage` (monthly), `credits` (monthly, per-surface tagged). Required scaffolding for monetization. 2 days.

6. **`POST /events/content` analytics** — log view + dwell + click + save events. Even without personalization, you'll need this data for later. 1 day.

7. **`canvasContext.visibleElementIds`** — use IntersectionObserver to track visible board items, send them with every chat call. 4 hours.

### Strategic but heavier

8. **Outlier scoring with Pareto-tail model** — replace our `view_count / median` with a proper `tau / median / mInfinity` per-segment-per-metric model. Need 30+ posts per creator before scoring. 3-4 days.

9. **Pillar taxonomy with `ext:` hierarchy** — adopt 3-tier `ext:tier1__tier2__tier3` taxonomy. Seed with Eden's visible top-level pillars (Productivity, Self-improvement, Business, Health, Content creation, Psychology). 1 day.

10. **Adaptive "For you" list auto-creation** when user pins a pillar. 4 hours.

11. **Typesense for cross-platform Discover** — replaces our SQL `creator_posts` filter with hybrid keyword + vector search. Requires running a Typesense instance + writing schema + ingest pipeline. **1 week**.

12. **Voice card v0/v1 versioning** with carry-forward rule. Store voice as JSON, append to history on each refine. 1-2 days.

13. **Two-stage relaxation** (strict → outlier-gte-5). Easy on top of (8). 4 hours.

14. **Switch LLM to DeepSeek V4 Pro via OpenRouter** as default ("regular" mode), keep Gemini Pro for "max" mode. 1 day. **10× cost reduction** on chats.

### Skip for personal-scale

- Tantivy local-sync engine — overkill until you have thousands of items per workspace
- InstantDB — Supabase + Realtime + custom CRDT works fine for our scale
- Discord OAuth, Loops.so, FirstPromoter — only when launching with monetization
- Orb billing — only when launching

## Building a replica — execution order

If we wanted to ship an Eden clone in 30 days:

```
Week 1 — Prompts + UX uplift
  Day 1-2: Drop in all 6 preset prompts + C8 protocol + thinking-style influences
  Day 3:   Switch chat default to DeepSeek V4 Pro via OpenRouter
  Day 4:   Add `mode: regular|max` toggle (UI + routing logic)
  Day 5:   Implement canvasContext.visibleElementIds attachment

Week 2 — Enrichment pipeline + mirror CDN
  Day 6-7:   Build social-mirror Supabase Storage worker
  Day 8-10:  Build post-enrichment Gemini job (taxonomy + aiOverview)

Week 3 — Discover upgrade + Pareto outliers
  Day 11-13: Pareto outlier baselines per creator
  Day 14-15: 3-tier pillar taxonomy + pinning UI
  Day 16-17: Typesense setup + hybrid search

Week 4 — Quotas, events, voice versioning
  Day 18-19: Three-quota meters + per-surface credit tagging
  Day 20-21: Events tracking (view + dwell)
  Day 22-24: Voice card v0/v1 carry-forward
  Day 25-28: Adaptive "For you" list + 2-stage relaxation
  Day 29-30: Polish, ship
```

Total: ~30 days for a single dev to build a recognizable Eden clone with all
the architectural ideas captured here.

## Appendix: full endpoint catalog

```yaml
# Universal profile resolution
POST   social.eden.so/profiles/resolve
  body: {profileUrl}
  res:  {ok, profile|null, message?, queued?}

GET    social.eden.so/profiles/<platform>/<platformId>/content
  res:  {ok, profile, content:[Post]}

# Top creators (for "people to follow")
GET    social.eden.so/creators/top
  res:  {ok, creators:[Creator]}

# Lists + members
GET    social.eden.so/workspaces/<ws>/lists
GET    social.eden.so/workspaces/<ws>/lists/<listId>/members

# Pillars
GET    social.eden.so/workspaces/<ws>/feed-pillars
PATCH  social.eden.so/workspaces/<ws>/feed-pillars
  body: {taxonomyIds:[…]}

# Hide / seen
GET    social.eden.so/workspaces/<ws>/discover-hidden

# The actual Discover feed
GET    social.eden.so/search/discover?<query string with all filters>

# Quotas
GET    social.eden.so/search/usage?workspaceId=<ws>
GET    ai.eden.so/workspaces/<ws>/boost-usage

# Interaction events
POST   social.eden.so/events/content

# Chats + LLM
GET    ai.eden.so/workspaces/<ws>/chats
POST   ai.eden.so/chats
  body: {workspaceId}
POST   ai.eden.so/chats/<chatId>/messages
  body: {message, mode, selectedItemIds, spaceId, canvasContext, systemPrompt}
  res:  SSE stream
GET    ai.eden.so/chats/<chatId>

# Sync engine (Tantivy-based)
GET    search.eden.so/workspaces/<ws>/manifest
GET    search.eden.so/workspaces/<ws>/snapshot  (binary)
GET    search.eden.so/workspaces/<ws>/blob       (JSON)
POST   search.eden.so/workspaces/<ws>/search/records
  body: {itemIds:[…]}

# Billing
GET    billing.eden.so/workspaces/<ws>/billing

# CDN
GET    public.eden.so/social-mirror/<platform>/<platformContentId>/thumbnail.jpg
GET    public.eden.so/social-mirror/<platform>/profiles/<platformUserId>/avatar-<contentHash>.jpg
```
