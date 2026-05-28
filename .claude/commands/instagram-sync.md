---
description: Instagram saves → Notion sync + ideate content for AI Creatives audience
---

# /instagram-sync

You operate the Instagram Saves Engine for an audience of **AI Creatives, AI Filmmaking, AI Ads, AI Video & Image**. The user invokes you with an action keyword. Dispatch on the action in `$ARGUMENTS` (default: `ideate` if empty).

## Configuration

- **Project directory:** `/Users/gangadhar/Personal/Instagram Saves Engine`
- **Instagram Saves** — database id `c3ddd222-a58c-42a9-87d6-81a03a6cd25f`, data source id `a5960982-d255-482b-88ba-eab6302034e2`
- **Content Ideas** — database id `e3b77af4-c528-4e64-9405-365016ca7081`, data source id `d3be4b44-b06e-449b-ad0d-e5534eaa4acc`
- **Audience:** AI Creatives, AI Filmmaking, AI Ads, AI Video & Image
- **Platforms:** Instagram, X/Twitter, YouTube
- **Pillars:** Teach, Showcase, Tools, Process, Trends
- **Collection → pillar map (default):**
  - `Content Ideas` → any pillar (choose by topic)
  - `Inspiration` → Showcase or Trends
  - Anything containing "tool" / "workflow" → Tools or Process
  - Anything else → Teach by default

> **API note:** The Notion CLI talks to API v2026-03-11. Queries hit `/v1/data_sources/{id}/query` (use the data source id). For page creation, use `parent: { data_source_id: ... }`. The Python sync.py still uses database_id via `notion-client` — that path is backward-compatible.

## Actions

Match `$ARGUMENTS` against these keywords. Use the closest match.

### `sync` — Run a sync now

1. `cd "/Users/gangadhar/Personal/Instagram Saves Engine"`
2. Run `.venv/bin/python3 sync.py` and stream output.
3. After it completes, if the summary line shows `N new` with N > 0, ask the user if they want to ideate now. If yes, fall through to the `ideate` action.

### `ideate` — Turn unprocessed saves into content ideas (6 steps)

**Step 1 — Fetch unprocessed saves + vision analysis.**
Query the Instagram Saves data source for entries where `Status` = `New`. Pull `Name`, `Caption`, `Author`, `Type`, `URL`, `Collection`, and the page ID for each. If the count is > 10, process in batches of 10 with a pause between batches for review.

```bash
ntn api v1/data_sources/a5960982-d255-482b-88ba-eab6302034e2/query -X POST \
  'filter[property]=Status' 'filter[select][equals]=New'
```

**Then for each save, fetch its page body** to read the `Vision Analysis` section (Gemini's deconstruction of the actual media — hook structure, on-screen text, pacing, replicable technique, tool signals). This is your PRIMARY input for ideation. The caption is secondary context.

```bash
ntn api v1/blocks/<page_id>/children -X GET 'page_size==100'
```

If a page has no Vision Analysis blocks (e.g., older saves before the feature, or a vision failure), fall back to caption-only ideation but flag this in the output so the user knows.

**Step 2 — Generate 1 idea per save.**
Use the **Vision Analysis** as your primary source — it tells you what the post actually does on screen. The caption is supplementary. Hooks should mirror real techniques observed in the source (e.g., "open with on-screen text" → write a hook that opens with on-screen text). Tool callouts should match the `Tools / Workflow Signals` section.

For each save, produce a structured idea object:

- **Reframe** the original concept for the AI Creatives / AI Filmmaking / AI Ads / AI Video & Image audience. Lean into what's actionable for someone building with AI creative tools (Sora, Runway, Veo, Midjourney, Flux, ComfyUI, etc.). Skip generic motivational angles.
- **Pillar** — pick one of: Teach, Showcase, Tools, Process, Trends. Use the collection → pillar map above as a starting point; override based on actual topic.
- **3 hook variations:**
  - *Curiosity:* an open loop or surprising claim
  - *Value:* a clear, concrete promise ("In 60s I'll show you…")
  - *Emotional:* tension, identity, or stakes ("If you still…")
- **Outline:** `HOOK → 3–4 KEY POINTS → CTA`. The CTA should be appropriate to the platform mix (follow / try the tool / comment a keyword / link in bio).
- **Platform breakdowns:**
  - *Instagram* — choose Carousel (for taxonomy, comparison, frameworks) or Reel (for demo, hook-first narrative). Specify slide count for carousels or shot list for reels.
  - *X/Twitter* — thread structure (number of posts, opener tweet, payoff). For visual demos, recommend a single tweet with media.
  - *YouTube* — include ONLY if the topic has long-form depth (tutorial, breakdown, case study). Otherwise write "Skip — not enough depth for long-form."
- **Format** — pick one for the Notion `Format` field: Carousel | Reel | Short Video | Long-form Video.
- **Priority:**
  - *High:* core-collection ("Content Ideas") saves, or timely/trend topics
  - *Medium:* strong audience overlap, evergreen
  - *Low:* tangential inspiration, weak fit

**Step 3 — Present for review.**
Print all generated ideas grouped clearly. For each: title, pillar, priority, platforms, the 3 hooks, the outline, and per-platform breakdowns. End with:

> Approve which? Options: `all` | `1,3,5` (comma-separated) | `skip all` | `modify N: <feedback>`

Wait for the user's reply. If they request modifications, regenerate those specific ideas with the feedback applied before asking again.

**Step 4 — Write approved ideas to Content Ideas DB.**
For each approved idea, create a page in the Content Ideas database. Properties:

- `Name` (title): idea title
- `Platform` (multi-select): Instagram, X, YouTube (only those covered)
- `Format` (select): Carousel / Reel / Short Video / Long-form Video
- `Status` (select): `Not started`
- `Angle` (rich_text): one-line angle/reframe
- `Hook Options` (rich_text): the 3 hooks joined by ` | `
- `Priority` (select): High / Medium / Low
- `Week Of` (date): the Monday of the current week (compute from today)
- `Pillar` (select): chosen pillar

Page body (as children blocks): angle paragraph, full outline as a bulleted list, then H2 sections for each covered platform with the breakdown underneath.

Parent must be the data source id, e.g.:
```bash
echo '{"parent":{"type":"data_source_id","data_source_id":"d3be4b44-b06e-449b-ad0d-e5534eaa4acc"}, "properties": {...}, "children": [...]}' \
  | ntn api v1/pages -X POST
```

**Step 5 — Mark originals.**
For each save processed:
- Approved → set its `Status` to `Used`
- Skipped → set its `Status` to `Reviewed`

```bash
ntn api v1/pages/<page_id> -X PATCH 'properties[Status][select][name]=Used'
```

**Step 6 — Print summary.**
```
SAVES IDEATION COMPLETE
  Saves processed: N
  Ideas generated: N
  Ideas saved to Notion: N
  Skipped (marked Reviewed): N

Saved ideas:
  • <title>
  • <title>

Next:
  • /instagram-sync recent     — see latest saves
  • Open Content Ideas in Notion to assign Week Of for production
```

### `status` — Check sync status

1. Read `state.json` and report total IDs synced.
2. Read the last 20 lines of `sync.log` and surface the last `Sync complete: …` line plus any errors.
3. Report the timestamp of the most recent log line as "last sync."

### `scheduler` — Check launchd job

Run `launchctl list | grep instagram-saves` and interpret the output. If present, report PID (or "—" if idle) and last exit status. If absent, tell the user the job isn't loaded and give the load command.

### `refresh session` / `refresh` — Walk through cookie refresh

1. Tell the user to open Chrome → instagram.com (signed in) → Cmd+Opt+I → Application tab → Cookies → `https://www.instagram.com`.
2. Have them copy the `sessionid`, `csrftoken`, and `ds_user_id` values.
3. Show them the current `config.json` keys (do NOT echo the existing cookie values back — just confirm which keys to replace).
4. After they update the file, run `.venv/bin/python3 sync.py` from the project directory to verify.

### `recent` — View recent saves

Query the Instagram Saves DB sorted by `Saved` desc, limit 20. Display author, type, caption (truncated to 80 chars), collection, status.

```bash
ntn api v1/data_sources/a5960982-d255-482b-88ba-eab6302034e2/query -X POST \
  'sorts[0][property]=Saved' 'sorts[0][direction]=descending' 'page_size:=20'
```

## Default behavior

If `$ARGUMENTS` is empty, run `ideate`.

## Notes

- Always use the Notion CLI (`ntn api ...`) for Notion calls — do not assume a Notion MCP is connected.
- When you `ntn api v1/databases/<id>/query`, results are paginated; loop on `next_cursor` until exhausted if more than 100 rows are pending.
- Truncate any rich_text content to 1900 chars before writing to Notion.
- Never echo cookie or token values to the user in plaintext.
