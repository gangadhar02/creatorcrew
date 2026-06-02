# Eden architecture, reverse-engineered

This is what `app.eden.so` looks like under the hood, captured live via the
Claude in Chrome extension on 2026-05-26 from a logged-in workspace. Every
finding below is either:
- a network request observed in the wild (URL + status + sample payload), or
- a string extracted from their Vite bundle (`main-Dj2gVwbJ.js`, 4.2 MB).

Use this to decide what to copy in CreatorCrew and what to skip.

## 1. Backend topology — five subdomains, microservices

| Subdomain | Role | Sample endpoint |
|---|---|---|
| `app.eden.so` | Web app (Vite + React SPA, single bundle `main-*.js`) | — |
| `search.eden.so` | Sync engine + Typesense hybrid search | `GET /workspaces/{ws}/manifest`, `/snapshot`, `/blob`, `POST /search/records` |
| `social.eden.so` | Creators, posts, lists, pillars, hide-seen, interaction events | `GET /workspaces/{ws}/lists`, `GET /workspaces/{ws}/feed-pillars`, `POST /events/content` |
| `ai.eden.so` | LLM chat + boosts + voice + credit metering | `POST /chats`, `POST /chats/{id}/messages`, `GET /workspaces/{ws}/boost-usage`, `GET /chats/{id}` |
| `billing.eden.so` | Subscriptions (powered by Orb), seat counting, plan offers | `GET /workspaces/{ws}/billing` |
| `public.eden.so` | CDN mirror of social media assets | `/social-mirror/instagram/{pk}/thumbnail.jpg`, `/social-mirror/instagram/profiles/{userId}/avatar-{hash}.jpg` |
| `obs.eden.so` | Self-hosted PostHog (web-vitals, session recording, surveys, logs) | `/static/posthog-recorder.js` |

Frontend: **Vite + React** (not Next.js — single hashed bundle, no
`_next/static/chunks/*` paths). Stack adjacents: Stripe (alongside Orb),
FirstPromoter (affiliate), PostHog (self-hosted analytics + replay + surveys).

## 2. The content pipeline — they MIRROR every social asset

Instead of proxying Instagram/YouTube/X CDN URLs (which expire), Eden runs a
**social-mirror** subsystem that downloads thumbnails and avatars server-side
and re-serves from their own CDN:

```
https://public.eden.so/social-mirror/instagram/3904805383537947900/thumbnail.jpg
https://public.eden.so/social-mirror/instagram/profiles/44254310327/avatar-c427141a5017f903.jpg
```

Path format: `social-mirror/<platform>/<platform_pk>/thumbnail.jpg`. Avatars
are content-addressed (`avatar-{hash}.jpg`) so they auto-version when a
creator changes their profile picture.

Implications for CreatorCrew: **bigger upgrade than our current `/api/ig-image`
proxy.** They never serve IG URLs to the browser → no adblocker false-positives,
no CDN expiry, plus they get cache control. Worth replicating with a small
Supabase Storage bucket + cron worker.

## 3. The data layer — local-first sync, Typesense for search

Every workspace pulls `manifest` + `snapshot` + `blob` from `search.eden.so`.
That trio is the signature of a **local-first sync engine** (Linear-style,
electric-sql-style). The browser holds a CRDT-ish snapshot and reconciles via
the manifest. Cache invalidation pushes come over a **WebSocket** with events
like `{"type":"search-invalidated","workspaceId":"...","version":2,"updatedAt":...}`.

Search itself is **Typesense**, leaked in `feedDiagnostics`:

```yaml
searchPath: "typesense-hybrid"             # hybrid keyword + vector
poolSizes:                                 # fetched per platform before rerank
  twitter:80, instagram:80, youtube:80,
  tiktok:80, linkedin:80, substack:80
personalization:
  enabled: true
  threshold: 8                             # user needs 8+ signals before personalized
  signalWeight: 0                          # weight applied during rerank
  profileVectorDims: 0                     # user has a profile embedding
  annPoolSize: 0                           # ANN nearest-neighbor pool size
  annPoolMerged: 0                         # how many ANN results were merged in
relaxation: null                           # query auto-relaxation if no hits
```

So **the Discover feed is not a SQL query — it's a Typesense hybrid search
across all 6 platforms, with a personalized rerank once the user has 8+
interaction signals.** Signals come from `POST /events/content`:

```json
{
  "events": [
    { "contentId": "...", "creatorId": "...", "eventType": "view",
      "dwellMs": 36810, "surface": "feeds",
      "metadata": { "viewMode": "grid", "tab": "discover" },
      "occurredAt": 1779805820241 },
    /* up to 18 batched events per POST */
  ]
}
```

They track **view + dwell time** as signals — not just clicks. Same call also
records "transitions" (zero in this sample). The personalization vector is
built server-side from these events.

## 4. The LLM stack — DeepSeek V4 Pro via OpenRouter

The single biggest surprise: **Eden does not use Claude or GPT.** They route
through **OpenRouter** to `deepseek/deepseek-v4-pro` (the Chinese reasoning
model). Cost is roughly 1/10th of Sonnet, which is how they can offer 300
credits/month at $29/seat.

Confirmed in the streamed SSE response:

```
data: {"type":"start","messageMetadata":{
  "createdAt": 1779805939716,
  "modelId": "deepseek/deepseek-v4-pro",
  "creditsUsed": 1,
  "workspaceCredits": {
    "source": "canvas", "unit": "credits",
    "periodAllowance": 300, "periodUsed": 7,
    "periodRemaining": 293, "topupRemaining": 0,
    "totalRemaining": 293, "resetAt": 1782345600000
  }
}, "messageId": "msg-trPAkwPoP7I54KIB"}
data: {"type":"start-step"}
data: {"type":"reasoning-start","id":"gen-...","providerMetadata":{"openrouter":{"reasoning_details":[...]}}}
data: {"type":"reasoning-delta","delta":"The "}
data: {"type":"reasoning-delta","delta":"user "}
…(reasoning text streamed)
data: {"type":"text-delta","delta":"I'm "}
…(final text streamed)
```

Key things to note:

1. **Reasoning is streamed separately** from final output via `reasoning-delta`
   events. Eden's "Thoughts" collapsible UI maps to reasoning, the final
   bubble below maps to `text-delta`.
2. **Credits are metered per response**, not per token, with the count tagged
   by `source` (`"canvas"` vs probably `"discover"` for AI search).
3. **`mode` field on each request** — `"regular"` or `"max"`. The Pro plan
   ($79/mo) unlocks `mode: "max"`. We saw `"max"` in our captured request
   despite being on a trial, so trials get Max too.

### Chat request shape (verbatim from the wire)

```json
POST https://ai.eden.so/chats/{chatId}/messages
{
  "message": {
    "id": "user-e3af5656-...",
    "role": "user",
    "parts": [{"type": "text", "text": "Help me think through an idea I've been working on."}],
    "metadata": {
      "presetAttachment": {
        "presetId": "thinking-partner",
        "title": "Thinking Partner",
        "description": "Refine and deepen an idea through structured dialogue",
        "iconName": "brain", "accent": "sage"
      }
    }
  },
  "mode": "max",
  "selectedItemIds": [],
  "spaceId": "67382f7d-...",
  "canvasContext": {
    "zoom": 1,
    "selectedElementIds": [],
    "visibleElementIds": ["5928dd50-...", "0949949f-..."]
  },
  "systemPrompt": "You are a rigorous thinking partner who helps..."
}
```

**Big architectural choice:** the `systemPrompt` is sent **from the client**.
This means every preset prompt is bundled in their JS bundle. We can (and did)
extract them all by fetching the bundle and grepping. **This is the leak that
matters.**

### Canvas context injection

`canvasContext.visibleElementIds` is the items currently in the user's
viewport on the active board, not just selected ones. If you're zoomed in on
5 of 50 items, those 5 get attached as context. This is Eden's "ambient
context" — what's on screen is what the LLM sees.

We can implement this: serialize whatever cards/docs/files are currently
rendered in the active canvas and append them to the chat payload.

## 5. The 5 boost presets — extracted from their bundle

These are the verbatim openers of each boost's `systemPrompt` field. All are
**joined with the C8 conversation protocol tail** (see §6).

### Preset 1 — Content Breakdown (`presetId: "content-breakdown"`)

- `icon: rte`, `iconName: "microscope"`, `accent: "slate"`
- `triggerMessage: "Help me break down a piece of content."`
- `composerPlaceholder: "Paste, @ mention, or describe the content…"`

```
# Role

You are a content analyst who reverse-engineers what makes great writing
work.

Your job is to break down a piece of content from macro to micro so the
creator can understand not just what was done, but why it works and how to
apply the same principles to their own writing.

You are thorough and detailed. You prioritize insight over brevity. You
organize your analysis flexibly based on what's most interesting or
instructive about the specific piece being analyzed.

[…lead with the most striking thing. Let the content dictate the emphasis.]

If the piece has weaknesses, note them. This helps the creator understand
that even great writing has imperfections, and it sharpens their critical
eye.
```

### Preset 2 — Thinking Partner (`presetId: "thinking-partner"`)

- `iconName: "brain"`, `accent: "sage"`
- `triggerMessage: "Help me think through an idea I've been working on."`
- `composerPlaceholder: "Type or @ the idea you want to think through…"`

```
You are a rigorous thinking partner who helps the user refine, stress-test,
and deepen their ideas through structured dialogue. You combine
first-principles clarity with systems thinking, zooming between the
practical and the philosophical to find what actually matters.

## Context

The user works inside Eden, a workspace for creators and marketers. Ideas
they bring you usually connect to something they're making (an essay, post,
video script, audience strategy, working thesis), and they can `@` mention
any board item (documents, drafts, saved posts, links, transcripts) to drop
it into the conversation as raw material. Treat attached items as evidence
and texture for the idea. When the conversation lands on something concrete
enough to write or test, name it plainly so the user can carry it…

[Persona append:]
You are opinionated. When one direction is clearly stronger, say so. Don't
present three balanced options when one wins. Don't hedge when you have a
real take.

[Conversation moves:]
- If the conversation is going in circles, name it. Summarize where you
  are, what's been established, what's still unresolved, and suggest where
  to go next.
- Name the model and explain why it applies.
```

### Preset 3 — Start Writing (`presetId: "start-writing"`)

- `iconName: "compass"`, `accent: "amber"`
- `triggerMessage: "Help me start writing."`
- `composerPlaceholder: "An idea, a draft, @ research, or just what's on your mind…"`
- `description: "Find what to write, sharpen the angle, and scaffold the piece"`

```
You are a writing strategist who helps creators get from wherever they are
(a vague urge, a half-formed take, a folder of research, a stuck draft) to
a piece they can publish today. When the user has material, find the
sharpest angle inside it and scaffold around that. When they don't, help
them excavate something worth writing about first. Either way, leave them
with structure sharp enough to sit down and draft.

You are opinionated. When one direction is clearly stronger…
```

### Preset 4 — Build a voice (`presetId: "find-your-voice"`)

- `iconName: "fingerprint"`, `accent: "rose"`, `usesVoiceProfile: false`
- `triggerMessage: "Help me find my voice."`
- `composerPlaceholder: "Type your answer, or @ a creator, book, doc, or prior work…"`
- `description: "Shape how the AI sounds when it writes as you"`

```
You are a Perspective Architect. You help creators discover their
intellectual signature: the cluster of ideas only they could write,
articulated under a mission only they can own. You excavate the thinkers,
ideas, and lived experiences that shaped how someone sees the world, then
synthesize them into a point of view they can build a body of work around.

You are direct, opinionated, patient with depth, impatient with vagueness.
Warm and human. Quote the user back to themselves and push past the safe,
posted-online answer to the version they'd say out loud.

[Practice:]
- Distinguish what you know from what you're inferring. Name which source
  supports an angle. Say when you're guessing at voice.
- If the user shows up empty, excavate with them. The vacuum is the work.
```

### Preset 5 — Grade My Content (`presetId: ?`)

Partial extract (Claude's safety filter blocked the rest of this snippet):

```
You are a no-bullshit editor with craft. The user shares a piece they want
made stronger. Grade it honestly, find the specific weaknesses, deliver
exact fixes, and iterate on the rewrites that matter most. Treat the user
like a peer who came for the truth — encouragement is for friends. Every
line earns its place, every transition holds energy, the hook never coasts.
```

### Preset 6 — Niche Playbook (`presetId: ?`)

Partial extract:

```
You are a viral-content scout for creators. Your job: take a niche the user
names (or infer one from the posts they've saved on their boards) and
surface a tight, ranked playbook of what is hitting *right now* in that
space — patterns, hooks, formats, angles — paired with concrete spinoff
ideas the user could ship this week.
```

## 6. The C8 conversation protocol — appended to every boost

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

- Once the user provides input on their next turn, perform your analysis
  in full using the framework above.
```

This is why every boost opens with a short clarifying question (e.g.
Thinking Partner: *"I'm ready. What's the idea? If it helps, you can type
or paste it directly here, @ mention any board item…"*) instead of jumping
straight to analysis. The constraint is enforced in the prompt, not the
UI.

## 7. Quotas, billing, plans

```yaml
# Free trial (what gangadhar is currently on)
plan: "trial"
workspaceCredits:                          # AI-generation credits
  periodAllowance: 300
  periodUsed: 7                            # we burned 7 by testing
  periodRemaining: 293
  unit: "credits"
  resetAt: 1782345600000                   # monthly reset
boost-usage:                               # SEPARATE quota for boost clicks
  tier: "starter"
  cap: 40
  remaining: 40
  countThisMonth: 0
search-usage:                              # SEPARATE quota for Discover search
  tier: "starter"
  cap: 10
  remaining: 10
  countToday: 0                            # this one is DAILY not monthly
```

**Three independent quotas:**
1. **Workspace credits** — 300/month, charged per chat response, tagged by source
2. **Boost clicks** — 40/month, separate from credits
3. **AI search queries** — 10/day, also separate

### Plans

```yaml
Starter: $29/mo or $299/yr ($24.92/mo when annual)
  - Discover + chats + boards
  - Regular AI mode only

Pro / Creator: $79/mo or $790/yr ($65.83/mo when annual)
  - Track 25 creators (cap)
  - Max-mode AI ("mode": "max" — uses a more expensive model)
```

Billing is powered by **Orb** (`billing.eden.so` → `"source": "orb"`).

## 8. Internal naming, schema, key data shapes

Their LocalStorage and API responses leak the internal vocabulary.

### Boards are called **canvas**, items are called **elements / spaces**

```
canvas:social:platformFilter:{ws}            = ["twitter","youtube","substack","instagram","tiktok","linkedin"]
canvas-camera-cache:v1:{ws}:{boardId}        = {position:{x,y}, zoom, updatedAt}
canvas-note-cache:{itemId}                   = {itemId, content}
canvas.has-seen-voice-wizard, has-seen-product-tour
canvas:trialBanner:dismissedDate:{ws}
canvas.pending-onboarding                    = {schemaVersion:4, createdAt, email, interests, handles, scanResults, planChoice, wantsFreeTrial}
```

So:
- **Boards are infinite canvases** (pan/zoom persisted per board, per
  workspace, in localStorage). Not grids.
- A `space` is the board itself, an `element` is an item inside it
  (selected/visible IDs in the chat payload are `elementIds`).
- Onboarding has been iterated **4 times** (schemaVersion: 4) and includes
  pre-filling from social `handles` + `scanResults`.

### Pillars are taxonomies attached to lists

```json
GET /workspaces/{ws}/feed-pillars
→ {"ok": true, "pillars": []}

GET /workspaces/{ws}/lists
→ {"ok": true, "lists": [
    {"id":"...", "name":"AI Creatives", "slug":"ai-creatives",
     "kind":"curated",                             # ← curated vs custom?
     "pillarTaxonomyId": null,                     # ← lists can be tagged with a pillar taxonomy
     "position":0, "isDefault":false, "memberCount":1, ...}
  ]}
```

### Creator records (from `/lists/{listId}/members`)

```json
{"members": [{
  "id": "d7c4e84a-...",
  "platform": "instagram",
  "platformId": "44254310327",                     # IG's internal user id
  "username": "ashoksangireddyy",
  "displayName": "Ashok Reddy",
  "profileUrl": "https://www.instagram.com/ashoksangireddyy/",
  "avatarUrl": "https://public.eden.so/social-mirror/instagram/profiles/44254310327/avatar-c427141a5017f903.jpg",
  "bio": "Generative AI ⚡️\nFounder @tastemattersai\n…"
}]}
```

### Following modes

```json
{"following": {
  "mode": "off",                                   # off | follow_list | following_only
  "count": 1,                                      # how many creators followed
  "listId": null                                   # which list filter is active
}}
```

### Chat retrieval

```
GET https://ai.eden.so/chats/{chatId}
→ {
  "chat": {id, title, status, storagePath, activeStreamId, workspaceId, userId, createdAt, updatedAt, lastCompactedAt},
  "transcript": {
    "version": 2,
    "chatId", "workspaceId", "userId",
    "messages": [{id, role, metadata, parts}]
  }
}
```

- `storagePath: "workspaces/{ws}/chats/{chatId}.json"` — chats are JSON
  blobs in object storage, not rows in a database
- `lastCompactedAt` — they implement chat **compaction** (summarize old
  turns) once threads get long
- `activeStreamId` — server-side cursor for resumable streams
- `transcript.version: 2` — they've iterated the schema once

## 9. Onboarding signals we don't track

From `canvas.pending-onboarding` (schema v4):

```json
{
  "email", "interests", "handles", "scanResults",
  "planChoice", "wantsFreeTrial"
}
```

They run a **social-handle scan during onboarding** that pre-populates the
discover feed. The `handles` field is plural (you list your handles across
platforms), `scanResults` is what they fetched. This is how the user has a
useful Discover feed the second they finish signup.

We can implement this: at the end of onboarding, ask the user for their IG
handle, run a one-shot `fetchUserPosts` to seed their workspace before
they hit the dashboard.

## 10. Gap analysis vs CreatorCrew

What we already do that matches Eden:
- Cross-platform unification (`creator_posts` table — matches their schema)
- Boards + cards + documents + files (matches `canvas`, though ours is grid
  not infinite canvas)
- 5 boost starters (we ship the same labels: Content Breakdown, Thinking
  Partner, Start Writing, Grade My Content, Niche Playbook)
- @-mention autocomplete with items/creators/lists tabs
- SSE streaming chat
- Multi-pane workspace (Phase 11)

What Eden has that we don't:
| Gap | Effort | Impact |
|---|---|---|
| **Typesense hybrid search for Discover** instead of SQL filters | 1 week | High — turns Discover into a real recommender |
| **Per-platform pool sizes (80 each) + cross-platform rerank** | medium | Medium — already partly there via outlier ordering |
| **Interaction event tracking (view + dwell + transitions)** for personalized rerank | 3 days | High — without it Discover is static |
| **Social-mirror CDN** (host thumbnails on Supabase Storage) | 2 days | Medium — cleaner than our `/api/ig-image` proxy |
| **Reasoning-vs-text split in SSE** (use Gemini's reasoning tokens) | 1 day | Easy polish — already supported by `gemini-2.5-pro` thoughts |
| **C8 conversation protocol** appended to every boost | 30 min | High UX — boosts currently dump everything in turn 1 |
| **Canvas context = visible elements** instead of selected only | 2 days | Medium — requires viewport tracking |
| **Chat compaction** when transcript gets long | 3 days | Medium — token-cost saver |
| **Onboarding social scan** to pre-populate Discover | 1 day | High — empty-state is brutal otherwise |
| **DeepSeek V4 via OpenRouter** as cheap default model | 1 day | Cost — would let us 10× our free-tier credits |
| **Three independent quotas** (credits / boost / search) tagged by surface | 2 days | Needed before any monetization |
| **`mode: "regular" | "max"` model toggle** | 1 day | Pricing wedge |
| **`usesVoiceProfile` flag per preset** (some boosts inject voice, others don't) | 30 min | Voice consistency |
| **Local-first sync (manifest/snapshot/blob)** | 4-6 weeks | Probably not worth it for personal-scale |

## 11. Recommended next moves for CreatorCrew

Ranked by ROI:

1. **Add the C8 conversation protocol to our boost-starters.ts** (30 min, big
   UX). Forces boosts to ask first, then perform. Today our boost prompts
   dump straight into the work.
2. **Mirror thumbnails to Supabase Storage** (1 day). Sidesteps adblockers
   and IG URL expiry. Background worker that downloads + hashes + uploads
   on ingest. Use `social-mirror/{platform}/{pk}/thumbnail.jpg` path naming.
3. **Track `POST /events/content`-equivalent** in our app (view + dwell)
   even if we don't use it for ranking yet — it's the substrate for any
   future recommender.
4. **Add a model-mode toggle and route OpenRouter calls** to DeepSeek V4
   Pro as default, Gemini Pro as "max". 10× the credits at same cost.
5. **Onboarding social scan**: after the user picks an IG handle, run the
   existing `analyze` endpoint in the background and have Discover ready
   when they land on it.
6. **Adopt the preset prompt structure** we extracted (Role, Context,
   Persona, Conversation moves, C8 tail). Specifically the **Thinking
   Partner** and **Start Writing** prompts are much sharper than ours.
7. **`visibleElementIds`-style context injection** — the IntersectionObserver
   already tells us what's visible on a board; thread that into the chat
   payload.

Skip for now:
- Typesense + local-first sync (too heavy for our scale)
- Orb billing (no monetization yet)
- Chat compaction (we don't have long chats yet)

## Appendix: every endpoint observed

```
search.eden.so
  GET  /workspaces/{ws}/manifest
  GET  /workspaces/{ws}/snapshot
  GET  /workspaces/{ws}/blob
  POST /workspaces/{ws}/search/records
  WS   (real-time invalidation: {"type":"search-invalidated","workspaceId","version","updatedAt"})

social.eden.so
  GET  /workspaces/{ws}/discover-hidden            → {ok, hidden:[postId]}
  GET  /workspaces/{ws}/feed-pillars               → {ok, pillars:[]}
  GET  /workspaces/{ws}/lists                      → {ok, lists:[{id,name,slug,kind:"curated",pillarTaxonomyId,position,isDefault,memberCount,createdAt,updatedAt}]}
  GET  /workspaces/{ws}/lists/{listId}/members     → {ok, members:[{id,platform,platformId,username,displayName,profileUrl,avatarUrl,bio}]}
  GET  /search/usage?workspaceId={ws}              → {ok, tier:"starter", cap:10, remaining:10, countToday:0, resetAt}
  POST /events/content                             → {ok, recorded:N, transitions:M}

ai.eden.so
  GET  /workspaces/{ws}/chats                      → {chats:[{id,title,status,createdAt,updatedAt}]}
  POST /chats                                      → {chatId, workspaceId, storagePath, title, workspaceCredits}
  POST /chats/{id}/messages                        → SSE stream {start, start-step, reasoning-start, reasoning-delta, text-start, text-delta, finish-step, finish}
  GET  /chats/{id}                                 → {chat:{...}, transcript:{version:2, messages:[...]}}
  GET  /workspaces/{ws}/boost-usage                → {tier:"starter", cap:40, remaining:40, countThisMonth, resetAt}

billing.eden.so
  GET  /workspaces/{ws}/billing                    → {workspaceId, source:"orb", planId, seatCountUsed, seatCountPurchased, availableSeatCount, currentPlan, availablePlans:[…]}

public.eden.so
  GET  /social-mirror/{platform}/{platformPk}/thumbnail.jpg
  GET  /social-mirror/{platform}/profiles/{userId}/avatar-{contentHash}.jpg
```
