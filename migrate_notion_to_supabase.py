"""One-shot: migrate existing Notion data to Supabase.

Reads from the Notion saves DB and content_ideas DB, converts page bodies
(Notion blocks) back to markdown, and inserts rows into Supabase.

After this finishes successfully, sync.py is the single writer to Supabase
and Notion can be archived/deleted.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from notion_client import Client as NotionClient
from supabase import create_client

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

SAVES_DS_ID = "a5960982-d255-482b-88ba-eab6302034e2"
IDEAS_DS_ID = "d3be4b44-b06e-449b-ad0d-e5534eaa4acc"

with open(HERE / "config.json") as f:
    cfg = json.load(f)

notion = NotionClient(auth=cfg["notion_token"])
sb = create_client(
    os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)


def rt_text(rt_array):
    return "".join(r.get("plain_text", "") for r in rt_array or [])


def page_props(props, name, kind):
    """Extract a value from a Notion property."""
    p = props.get(name, {})
    if kind == "title":
        return rt_text(p.get("title", []))
    if kind == "rich_text":
        return rt_text(p.get("rich_text", []))
    if kind == "select":
        return (p.get("select") or {}).get("name")
    if kind == "multi_select":
        return [opt["name"] for opt in p.get("multi_select", [])]
    if kind == "url":
        return p.get("url")
    if kind == "date":
        return (p.get("date") or {}).get("start")
    return None


def fetch_all_children(page_id):
    out = []
    cursor = None
    while True:
        kw = {"page_size": 100}
        if cursor:
            kw["start_cursor"] = cursor
        res = notion.blocks.children.list(block_id=page_id, **kw)
        out.extend(res["results"])
        if not res.get("has_more"):
            break
        cursor = res.get("next_cursor")
    return out


def blocks_to_markdown(blocks):
    lines = []
    for b in blocks:
        t = b.get("type")
        if t == "heading_1":
            lines.append(f"# {rt_text(b['heading_1']['rich_text'])}")
        elif t == "heading_2":
            lines.append(f"## {rt_text(b['heading_2']['rich_text'])}")
        elif t == "heading_3":
            lines.append(f"### {rt_text(b['heading_3']['rich_text'])}")
        elif t == "paragraph":
            text = rt_text(b["paragraph"]["rich_text"])
            if text.strip():
                lines.append(text)
        elif t == "bulleted_list_item":
            lines.append(f"- {rt_text(b['bulleted_list_item']['rich_text'])}")
        elif t == "numbered_list_item":
            lines.append(f"1. {rt_text(b['numbered_list_item']['rich_text'])}")
        elif t == "quote":
            lines.append(f"> {rt_text(b['quote']['rich_text'])}")
        elif t == "code":
            text = rt_text(b["code"]["rich_text"])
            lang = b["code"].get("language", "")
            lines.append(f"```{lang}\n{text}\n```")
        elif t == "divider":
            lines.append("---")
    return "\n\n".join(lines)


def fetch_all_pages(data_source_id):
    out = []
    cursor = None
    while True:
        kw = {"page_size": 100}
        if cursor:
            kw["start_cursor"] = cursor
        res = notion.data_sources.query(data_source_id=data_source_id, **kw)
        out.extend(res["results"])
        if not res.get("has_more"):
            break
        cursor = res.get("next_cursor")
    return out


# =========================================================================
# Migrate saves
# =========================================================================
print("=== Migrating Saves ===")
notion_saves = fetch_all_pages(SAVES_DS_ID)
print(f"Found {len(notion_saves)} Notion save pages")

saves_pk_to_id = {}  # media_pk → supabase save id

for np in notion_saves:
    props = np["properties"]
    media_pk = page_props(props, "Media ID", "rich_text").strip()
    if not media_pk:
        print(f"  skip (no Media ID): {np['id']}")
        continue
    name = page_props(props, "Name", "title")
    url = page_props(props, "URL", "url") or ""
    typ = page_props(props, "Type", "select") or "Post"
    author = page_props(props, "Author", "rich_text") or None
    caption = page_props(props, "Caption", "rich_text") or None
    collection = page_props(props, "Collection", "select")
    status = page_props(props, "Status", "select") or "New"
    saved = page_props(props, "Saved", "date")

    # Fetch page body for vision analysis
    children = fetch_all_children(np["id"])
    vision_md = None
    if children:
        # Strip the leading "Vision Analysis" heading_1 if present
        if children and children[0].get("type") == "heading_1":
            heading_text = rt_text(children[0]["heading_1"]["rich_text"])
            if heading_text.strip().lower() == "vision analysis":
                children = children[1:]
        vision_md = blocks_to_markdown(children) or None

    # Derive code from URL: /reel/CODE/ or /p/CODE/
    code = None
    m = re.search(r"/(?:reel|p|tv)/([^/?]+)", url)
    if m:
        code = m.group(1)

    row = {
        "media_pk": media_pk,
        "code": code,
        "url": url,
        "type": typ,
        "author": author,
        "caption": caption,
        "collection_name": collection,
        "status": status,
        "saved_at": saved,
        "vision_analysis_md": vision_md,
        "vision_analyzed_at": datetime.now(timezone.utc).isoformat() if vision_md else None,
    }
    try:
        res = sb.table("saves").insert(row).execute()
        saves_pk_to_id[media_pk] = res.data[0]["id"]
        vis_len = len(vision_md) if vision_md else 0
        print(f"  + @{author or '?'} {typ} ({media_pk}) vision={vis_len}c")
    except Exception as e:
        print(f"  ERR @{author} {media_pk}: {e}")

print(f"Migrated {len(saves_pk_to_id)} saves")

# =========================================================================
# Migrate content_ideas (with save_id linkage best-effort)
# =========================================================================
print("\n=== Migrating Content Ideas ===")
notion_ideas = fetch_all_pages(IDEAS_DS_ID)
print(f"Found {len(notion_ideas)} Notion content idea pages")

# Linkage map from our earlier ideation run: title → media_pk
# Recovered by reading /tmp/write_ideas.py IDEAS list against /tmp/saves_to_process.json
try:
    saves_meta = json.load(open("/tmp/saves_to_process.json"))
    # /tmp/saves_to_process.json was built from a Notion query (no media_pk),
    # so re-query Notion saves by page_id to map page_id → media_pk
    page_id_to_pk = {}
    for np in notion_saves:
        mp = page_props(np["properties"], "Media ID", "rich_text").strip()
        if mp:
            page_id_to_pk[np["id"]] = mp
    # And map title → pk via the IDEAS list in write_ideas.py
    # We'll hardcode that mapping below since the file isn't easily importable.
    # idx in IDEAS → saves_meta index → page_id → media_pk
    IDEA_TITLE_TO_IDX = {
        "Higgsfield Cinema Studio 2.5: the AI video series tool no one's covering yet": 0,
        "Build a 'Carousel Machine' in Claude — 60s viral carousels on autopilot": 1,
        "The InVideo AI shortcut: ship a monetizable short in 5 steps": 2,
        "How to use AI to tell cultural/heritage stories that actually hit": 3,
        "AI character work for music videos: 30-second concept → release-ready": 4,
        "Stack Seedance 2 + Higgsfield to make Hollywood-scale shots solo": 5,
        "The 'beautiful AI girl' era is dying — why ugly/raw AI is the next trend": 6,
        "Atmosphere > action: how to make AI shorts feel emotional, not flashy": 7,
        "Map the evolution of AI art aesthetics in 60 seconds": 9,
        "The 'Director's Kit': lock style consistency across an entire AI video": 10,
    }
    title_to_pk = {}
    for title, idx in IDEA_TITLE_TO_IDX.items():
        save_page_id = saves_meta[idx]["page_id"]
        pk = page_id_to_pk.get(save_page_id)
        if pk:
            title_to_pk[title] = pk
except Exception as e:
    print(f"  warn: couldn't build idea→save linkage: {e}")
    title_to_pk = {}


def parse_idea_body(blocks):
    """Pull angle, outline, and platform breakdowns from the page body."""
    angle = None
    outline_lines = []
    platform_sections = {}  # h2 text → list of lines

    current_section = None  # "outline" | (platform-name) | None
    for b in blocks:
        t = b.get("type")
        if t == "paragraph":
            text = rt_text(b["paragraph"]["rich_text"])
            if not angle and text.lower().startswith("angle:"):
                angle = text.split(":", 1)[1].strip()
                continue
            if current_section == "outline":
                outline_lines.append(text)
            elif current_section:
                platform_sections.setdefault(current_section, []).append(text)
        elif t == "heading_2":
            heading = rt_text(b["heading_2"]["rich_text"]).strip()
            if heading.lower() == "outline":
                current_section = "outline"
            else:
                current_section = heading
                platform_sections.setdefault(heading, [])
        elif t == "bulleted_list_item":
            text = rt_text(b["bulleted_list_item"]["rich_text"])
            if current_section == "outline":
                outline_lines.append(f"- {text}")
            elif current_section:
                platform_sections.setdefault(current_section, []).append(f"- {text}")
    outline_md = "\n".join(outline_lines) or None

    # Map common heading names to columns
    def get_section(*names):
        for n in names:
            for key, val in platform_sections.items():
                if n.lower() in key.lower():
                    return "\n".join(val) or None
        return None

    return {
        "angle": angle,
        "outline_md": outline_md,
        "ig_breakdown_md": get_section("instagram"),
        "x_breakdown_md": get_section("x", "twitter"),
        "youtube_breakdown_md": get_section("youtube"),
    }


ideas_migrated = 0
for ip in notion_ideas:
    props = ip["properties"]
    name = page_props(props, "Name", "title")
    pillar = page_props(props, "Pillar", "select")
    priority = page_props(props, "Priority", "select")
    fmt = page_props(props, "Format", "select")
    platforms = page_props(props, "Platform", "multi_select") or []
    hooks = page_props(props, "Hook Options", "rich_text") or ""
    angle_prop = page_props(props, "Angle", "rich_text")
    week_of = page_props(props, "Week Of", "date")
    status = page_props(props, "Status", "select") or "Not started"

    hook_parts = [p.strip() for p in hooks.split("|")]
    hook_curiosity = hook_parts[0] if len(hook_parts) > 0 else None
    hook_value = hook_parts[1] if len(hook_parts) > 1 else None
    hook_emotional = hook_parts[2] if len(hook_parts) > 2 else None
    # Strip prefixes like "Curiosity: " / "Value: " / "Emotional: "
    def strip_prefix(s):
        if not s:
            return s
        for prefix in ("Curiosity:", "Value:", "Emotional:"):
            if s.startswith(prefix):
                return s[len(prefix):].strip()
        return s
    hook_curiosity = strip_prefix(hook_curiosity)
    hook_value = strip_prefix(hook_value)
    hook_emotional = strip_prefix(hook_emotional)

    children = fetch_all_children(ip["id"])
    body = parse_idea_body(children)

    # Linkage
    save_pk = title_to_pk.get(name)
    save_id = saves_pk_to_id.get(save_pk) if save_pk else None

    row = {
        "save_id": save_id,
        "name": name,
        "pillar": pillar,
        "priority": priority,
        "format": fmt,
        "platforms": platforms,
        "angle": angle_prop or body.get("angle"),
        "hook_curiosity": hook_curiosity,
        "hook_value": hook_value,
        "hook_emotional": hook_emotional,
        "outline_md": body.get("outline_md"),
        "ig_breakdown_md": body.get("ig_breakdown_md"),
        "x_breakdown_md": body.get("x_breakdown_md"),
        "youtube_breakdown_md": body.get("youtube_breakdown_md"),
        "week_of": week_of,
        "status": status,
    }
    try:
        sb.table("content_ideas").insert(row).execute()
        ideas_migrated += 1
        linked = "→" + save_pk[:8] if save_pk else "(unlinked)"
        print(f"  + {name[:60]} {linked}")
    except Exception as e:
        print(f"  ERR {name}: {e}")

print(f"\nMigrated {len(saves_pk_to_id)} saves, {ideas_migrated} ideas to Supabase")
