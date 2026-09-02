#!/usr/bin/env python3
"""Sync Instagram saved posts to Supabase.

Fetches saves from Instagram's web API using cookies in config.json, runs
optional Gemini vision analysis on each new media item, and upserts rows into
the Supabase `saves` table. Dedup is sourced from Supabase (no state.json) so
the database is the single source of truth.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client, Client as SupabaseClient

from vision import VisionAnalyzer

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "config.json"
ENV_PATH = HERE / ".env"
LOG_PATH = HERE / "sync.log"

IG_BASE = "https://www.instagram.com/api/v1"
IG_APP_ID = "936619743392459"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)

# Exponential backoff for transient IG failures (429, 5xx). The background
# sync can afford to wait longer than a user-facing request.
RETRY_DELAYS_S = [60, 300, 900]  # 1m, 5m, 15m

logger_for_retry: logging.Logger | None = None


def ig_get(session: requests.Session, url: str, **kwargs) -> requests.Response:
    """GET wrapper with rate-limit/server-error backoff. Raises SystemExit on
    auth failure (cookies invalid) — caller doesn't need to handle that."""
    global logger_for_retry
    last_status = None
    for attempt in range(len(RETRY_DELAYS_S) + 1):
        r = session.get(url, **kwargs)
        last_status = r.status_code
        if r.ok:
            return r
        if r.status_code in (401, 403):
            return r  # let caller handle (validate_session exits with msg)
        is_retryable = r.status_code == 429 or r.status_code >= 500
        if not is_retryable or attempt >= len(RETRY_DELAYS_S):
            return r
        delay = RETRY_DELAYS_S[attempt]
        if logger_for_retry:
            logger_for_retry.warning(
                f"ig_get: HTTP {r.status_code} on {url[:80]} — "
                f"retry {attempt + 1}/{len(RETRY_DELAYS_S)} in {delay}s"
            )
        time.sleep(delay)
    return r  # unreachable but keeps type-checkers happy


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("instagram-sync")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    fh = logging.FileHandler(LOG_PATH)
    fh.setFormatter(fmt)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.addHandler(sh)
    return logger


def load_config() -> dict:
    """Load config from config.json (local Mac runs) OR env vars (CI / cloud).

    Env vars take precedence over the JSON file when both are set. This
    lets GitHub Actions (and any other cloud cron host) supply Instagram
    cookies via Secrets without committing them to the repo.
    """
    load_dotenv(ENV_PATH)

    # Start from JSON if it exists, otherwise empty dict.
    cfg: dict = {}
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open() as f:
            cfg = json.load(f)

    # Env vars layer on top — useful when sync.py runs without a local
    # config.json (e.g. GitHub Actions workflow_dispatch).
    env_map = {
        "IG_SESSION_ID": "ig_session_id",
        "IG_CSRFTOKEN": "ig_csrftoken",
        "IG_USER_ID": "ig_user_id",
        "GEMINI_API_KEY": "gemini_api_key",
        "VISION_MODEL": "vision_model",
    }
    for env_name, cfg_key in env_map.items():
        v = os.environ.get(env_name)
        if v:
            cfg[cfg_key] = v

    # Bool / list flags from env if present
    if os.environ.get("ENABLE_VISION_ANALYSIS") is not None:
        cfg["enable_vision_analysis"] = os.environ.get(
            "ENABLE_VISION_ANALYSIS"
        ).lower() in ("1", "true", "yes")
    if os.environ.get("KEEP_MEDIA_FILES") is not None:
        cfg["keep_media_files"] = os.environ.get(
            "KEEP_MEDIA_FILES"
        ).lower() in ("1", "true", "yes")
    collections_env = os.environ.get("COLLECTIONS_FILTER")
    if collections_env:
        cfg["collections_filter"] = [
            c.strip() for c in collections_env.split(",") if c.strip()
        ]

    # Hard fail if we still don't have the IG cookies.
    required = ("ig_session_id", "ig_csrftoken", "ig_user_id")
    missing = [k for k in required if not cfg.get(k)]
    if missing:
        sys.exit(
            "Missing Instagram cookies: " + ", ".join(missing) + ". "
            "Set them via config.json (local) or env vars IG_SESSION_ID / "
            "IG_CSRFTOKEN / IG_USER_ID (CI)."
        )
    return cfg


def make_supabase() -> SupabaseClient:
    load_dotenv(ENV_PATH)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env")
    return create_client(url, key)


def fetch_existing_pks(sb: SupabaseClient, log: logging.Logger) -> set[str]:
    """Pull all media_pk values currently in the saves table (dedup source)."""
    pks: set[str] = set()
    page_size = 1000
    offset = 0
    while True:
        res = (
            sb.table("saves")
            .select("media_pk")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = [r["media_pk"] for r in res.data]
        pks.update(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    log.info(f"Loaded {len(pks)} existing media IDs from Supabase")
    return pks


def make_ig_session(cfg: dict) -> requests.Session:
    """Personal SaveSync account only (ig_session_id in config.json).

    Scraping / Profile Analyzer / Discover search use the webapp's separate
    ig_scrape_* cookies — never mix them here."""
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": USER_AGENT,
            "X-IG-App-ID": IG_APP_ID,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://www.instagram.com/",
            "X-CSRFToken": cfg["ig_csrftoken"],
        }
    )
    s.cookies.set("sessionid", cfg["ig_session_id"], domain=".instagram.com")
    s.cookies.set("csrftoken", cfg["ig_csrftoken"], domain=".instagram.com")
    s.cookies.set("ds_user_id", str(cfg["ig_user_id"]), domain=".instagram.com")
    return s


def validate_session(s: requests.Session, log: logging.Logger) -> None:
    global logger_for_retry
    logger_for_retry = log
    r = ig_get(s, f"{IG_BASE}/accounts/edit/web_form_data/")
    if r.status_code != 200:
        log.error(f"Session validation failed: HTTP {r.status_code} {r.text[:200]}")
        sys.exit(
            "Instagram session invalid. Refresh sessionid/csrftoken/ds_user_id "
            "in config.json (Chrome DevTools > Application > Cookies)."
        )
    username = "?"
    try:
        body = r.json()
        username = (
            body.get("form_data", {}).get("username")
            or body.get("username")
            or "?"
        )
    except Exception:
        pass
    log.info(f"Instagram session valid for @{username}")


def fetch_collections(s: requests.Session) -> list[dict]:
    params = {
        "collection_types": '["ALL_MEDIA_AUTO_COLLECTION","PRODUCT_AUTO_COLLECTION","MEDIA"]'
    }
    r = ig_get(s, f"{IG_BASE}/collections/list/", params=params)
    r.raise_for_status()
    return r.json().get("items", [])


def iter_collection_posts(s: requests.Session, collection_id: str):
    next_max_id = None
    while True:
        params = {"count": 50}
        if next_max_id:
            params["max_id"] = next_max_id
        r = ig_get(
            s,
            f"{IG_BASE}/feed/collection/{collection_id}/posts/",
            params=params,
        )
        r.raise_for_status()
        data = r.json()
        for item in data.get("items", []):
            yield item
        if not data.get("more_available") or not data.get("next_max_id"):
            break
        next_max_id = data["next_max_id"]
        time.sleep(1)


def iter_all_saves(s: requests.Session):
    next_max_id = None
    while True:
        params = {"count": 50}
        if next_max_id:
            params["max_id"] = next_max_id
        r = ig_get(s, f"{IG_BASE}/feed/saved/posts/", params=params)
        r.raise_for_status()
        data = r.json()
        for item in data.get("items", []):
            yield item
        if not data.get("more_available") or not data.get("next_max_id"):
            break
        next_max_id = data["next_max_id"]
        time.sleep(1)


def normalize_media(item: dict) -> dict | None:
    media = item.get("media", item)
    pk = media.get("pk") or media.get("id")
    if not pk:
        return None
    code = media.get("code", "")
    media_type = media.get("media_type")
    product_type = media.get("product_type", "") or ""

    if product_type == "clips":
        kind = "Reel"
    elif product_type == "igtv":
        kind = "IGTV"
    elif media_type == 8:
        kind = "Carousel"
    else:
        kind = "Post"

    url = (
        f"https://instagram.com/reel/{code}/"
        if kind == "Reel"
        else f"https://instagram.com/p/{code}/"
    )
    user = media.get("user", {}) or {}
    caption_obj = media.get("caption") or {}
    caption = caption_obj.get("text", "") if isinstance(caption_obj, dict) else ""

    return {
        "pk": str(pk),
        "code": code,
        "type": kind,
        "url": url,
        "author": user.get("username", ""),
        "caption": caption,
    }


def to_supabase_row(
    post: dict,
    collection_name: str | None,
    raw_item: dict,
    workspace_id: str | None = None,
) -> dict:
    return {
        "media_pk": post["pk"],
        "code": post["code"] or None,
        "url": post["url"],
        "type": post["type"],
        "author": post["author"] or None,
        "caption": post["caption"] or None,
        "collection_name": collection_name,
        "status": "New",
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "ig_raw_json": raw_item,
        # Scope saves to the workspace so other accounts don't see them
        # (migration_023). Nullable for legacy rows.
        "workspace_id": workspace_id,
    }


def get_workspace_id(sb: SupabaseClient) -> str | None:
    """Resolve which workspace to write into.

    Resolution order:
      1. SYNC_WORKSPACE_ID env var (explicit override — recommended for CI).
      2. SYNC_WORKSPACE_EMAIL env var → look up workspaces.owner_email.
      3. First workspace by created_at (legacy single-tenant fallback).
    """
    explicit = os.environ.get("SYNC_WORKSPACE_ID")
    if explicit:
        return explicit
    try:
        sync_email = os.environ.get("SYNC_WORKSPACE_EMAIL")
        if sync_email:
            r = (
                sb.table("workspaces")
                .select("id")
                .eq("owner_email", sync_email)
                .limit(1)
                .execute()
            )
            if r.data:
                return r.data[0]["id"]
        r = sb.table("workspaces").select("id").order("created_at").limit(1).execute()
        return r.data[0]["id"] if r.data else None
    except Exception:
        return None


def upsert_creator(
    sb: SupabaseClient, workspace_id: str, platform: str, handle: str
) -> str | None:
    """Find or create a creator row. Returns the creator id (or None if it can't be created)."""
    if not handle:
        return None
    try:
        existing = (
            sb.table("creators")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("platform", platform)
            .eq("handle", handle)
            .limit(1)
            .execute()
        )
        if existing.data:
            return existing.data[0]["id"]
        inserted = (
            sb.table("creators")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "platform": platform,
                    "handle": handle,
                }
            )
            .execute()
        )
        return inserted.data[0]["id"] if inserted.data else None
    except Exception:
        return None


def upsert_creator_post(
    sb: SupabaseClient,
    creator_id: str | None,
    post: dict,
    raw_item: dict,
) -> str | None:
    """Idempotent upsert into creator_posts keyed by (platform, platform_pk).
    Returns the creator_post id, or None on failure."""
    row = {
        "creator_id": creator_id,
        "platform": "instagram",
        "platform_pk": post["pk"],
        "code": post["code"] or None,
        "url": post["url"],
        "media_type": post["type"],
        "title_or_caption": post["caption"] or None,
        "raw_json": raw_item,
    }
    try:
        # Try insert first
        inserted = (
            sb.table("creator_posts").insert(row).execute()
        )
        return inserted.data[0]["id"] if inserted.data else None
    except Exception:
        # Likely already exists (unique on platform+platform_pk); fetch it
        try:
            existing = (
                sb.table("creator_posts")
                .select("id")
                .eq("platform", "instagram")
                .eq("platform_pk", post["pk"])
                .limit(1)
                .execute()
            )
            return existing.data[0]["id"] if existing.data else None
        except Exception:
            return None


def main() -> None:
    log = setup_logging()
    cfg = load_config()
    sb = make_supabase()

    # Resolve the workspace up front so the sync_runs row + saves are scoped.
    workspace_id = get_workspace_id(sb)

    # Open a sync_runs row
    run = (
        sb.table("sync_runs")
        .insert({"status": "running", "workspace_id": workspace_id})
        .execute()
    )
    run_id = run.data[0]["id"]
    log.info(f"sync_run {run_id} started")

    try:
        existing = fetch_existing_pks(sb, log)
        if workspace_id:
            log.info(f"Dual-writing to creator_posts (workspace={workspace_id[:8]}…)")
        else:
            log.warning("No workspace found — skipping creator_posts dual-write")

        s = make_ig_session(cfg)
        validate_session(s, log)

        collections_filter = cfg.get("collections_filter") or []
        items_with_collection: list[tuple[dict, str | None]] = []

        use_all_saves = not collections_filter
        if collections_filter:
            try:
                collections = fetch_collections(s)
                log.info(f"Found {len(collections)} collections on Instagram")
                wanted = {
                    c.get("collection_name"): c.get("collection_id")
                    for c in collections
                    if c.get("collection_name") in collections_filter
                }
                missing = set(collections_filter) - set(wanted)
                if missing:
                    log.warning(
                        f"Collections in filter not found on Instagram: {missing}"
                    )
                for name, cid in wanted.items():
                    log.info(f"Fetching collection: {name} (id={cid})")
                    try:
                        for item in iter_collection_posts(s, cid):
                            items_with_collection.append((item, name))
                    except Exception as e:
                        log.error(f"Failed to fetch collection {name}: {e}")
            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response is not None else "?"
                log.warning(
                    f"Instagram's collections/list endpoint returned HTTP {status} "
                    "(Meta appears to have retired it server-side). Falling back "
                    "to syncing all saved posts; collection tagging is disabled "
                    "for this run."
                )
                use_all_saves = True

        if use_all_saves:
            log.info("Fetching all saved posts (no collection filter)")
            for item in iter_all_saves(s):
                items_with_collection.append((item, None))

        vision: VisionAnalyzer | None = None
        if cfg.get("enable_vision_analysis"):
            api_key = cfg.get("gemini_api_key")
            if not api_key or api_key.startswith("PASTE_"):
                log.warning(
                    "enable_vision_analysis is true but gemini_api_key is not set; skipping vision"
                )
            else:
                vision = VisionAnalyzer(
                    api_key=api_key,
                    model=cfg.get("vision_model", "gemini-2.5-flash"),
                    media_dir=HERE / "media",
                    log=log,
                )
                log.info(f"Vision analysis enabled (model={vision.model})")

        new_count = 0
        skipped = 0
        errors = 0
        vision_count = 0
        vision_errors = 0
        seen_in_run: set[str] = set()

        for item, collection_name in items_with_collection:
            post = normalize_media(item)
            if not post:
                continue
            if post["pk"] in existing or post["pk"] in seen_in_run:
                skipped += 1
                continue
            seen_in_run.add(post["pk"])
            row = to_supabase_row(post, collection_name, item, workspace_id)
            try:
                inserted = sb.table("saves").insert(row).execute()
                save_id = inserted.data[0]["id"]
                new_count += 1
                existing.add(post["pk"])
                log.info(
                    f"+ {post['type']} @{post['author']} ({post['pk']}) "
                    f"[{collection_name or '-'}]"
                )
            except Exception as e:
                errors += 1
                log.error(f"Supabase insert failed for {post['pk']}: {e}")
                continue

            # Dual-write: also create the unified creator + creator_post rows.
            creator_post_id: str | None = None
            if workspace_id:
                creator_id = upsert_creator(
                    sb, workspace_id, "instagram", post["author"]
                )
                creator_post_id = upsert_creator_post(sb, creator_id, post, item)
                if creator_post_id:
                    try:
                        sb.table("saves").update(
                            {"creator_post_id": creator_post_id}
                        ).eq("id", save_id).execute()
                    except Exception as e:
                        log.warning(
                            f"  dual-write: link saves.creator_post_id failed for {post['pk']}: {e}"
                        )

            if vision:
                analysis = vision.analyze(item, post["pk"], caption=post["caption"])
                if analysis:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    try:
                        sb.table("saves").update(
                            {
                                "vision_analysis_md": analysis,
                                "vision_analyzed_at": now_iso,
                            }
                        ).eq("id", save_id).execute()
                        if creator_post_id:
                            sb.table("creator_posts").update(
                                {
                                    "vision_analysis_md": analysis,
                                    "vision_analyzed_at": now_iso,
                                }
                            ).eq("id", creator_post_id).execute()
                        vision_count += 1
                        log.info(f"  vision: analysis attached ({len(analysis)} chars)")
                    except Exception as e:
                        vision_errors += 1
                        log.error(f"  vision: supabase update failed for {post['pk']}: {e}")
                else:
                    vision_errors += 1
                if not cfg.get("keep_media_files"):
                    vision.cleanup(post["pk"])

        total = len(items_with_collection)
        log_excerpt = ""
        try:
            log_excerpt = LOG_PATH.read_text().splitlines()[-30:]
            log_excerpt = "\n".join(log_excerpt)
        except Exception:
            pass

        sb.table("sync_runs").update(
            {
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "status": "completed",
                "new_count": new_count,
                "skipped_count": skipped,
                "total_count": total,
                "vision_ok": vision_count,
                "vision_err": vision_errors,
                "log_excerpt": log_excerpt,
            }
        ).eq("id", run_id).execute()

        vision_msg = (
            f" | vision: {vision_count} ok / {vision_errors} err"
            if vision is not None
            else ""
        )
        log.info(
            f"Sync complete: {new_count} new | {skipped} skipped | "
            f"{total} total | {errors} errors{vision_msg}"
        )

    except SystemExit:
        raise
    except Exception as e:
        log.exception("Sync run failed")
        try:
            sb.table("sync_runs").update(
                {
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "status": "failed",
                    "error_message": str(e)[:1000],
                }
            ).eq("id", run_id).execute()
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
