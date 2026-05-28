"""Vision analysis for Instagram media using Gemini.

Given a raw IG saved-feed item, downloads the underlying media (image / video /
carousel) and runs Gemini multimodal analysis tailored for AI-creator content
ideation. Returns markdown that gets attached to the Notion page.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import requests
from google import genai
from google.genai import types

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)

VISION_PROMPT = """You are analyzing an Instagram post for a content creator whose audience is **AI Creatives, AI Filmmakers, AI Ads creators, and AI Video & Image producers**.

Reverse-engineer what makes this content work. Be specific and tactical — every section should give the creator something they can lift directly. Avoid vague principles.

Output as plain markdown with these EXACT section headers (use `##`):

## Hook (first 0-3 seconds)
The opening frame/line that stops the scroll. Quote on-screen text or describe the visual. Explain why it works.

## Visual Structure
- Format: (single shot / cuts / split-screen / talking head / screen recording / b-roll over voiceover / etc)
- Shot count (approx)
- Pacing: (slow / medium / fast / rapid)
- Key visual moments — timestamp-style for video (e.g. "0:00 — opening shot; 0:04 — cut to..."); slide-by-slide for carousel.

## On-Screen Text
List every piece of text that appears on screen, in order. Quote exactly. If none, say "None."

## Audio / Voiceover
(Skip for static images.) Voiceover style (narrator / first-person / dialogue / none), music tempo + mood, audio hook moments.

## Replicable Technique
The ONE technique an AI Creator could lift directly. Be concrete — a prompt pattern, an editing move, a hook structure, a transition. Not a principle.

## Tools / Workflow Signals
What AI tools or workflow does this look like it used? (Sora, Runway, Higgsfield, Veo, Midjourney, Flux, ComfyUI, Seedance, Kling, Pika, Claude, etc.) Cite the visual evidence you saw.

## Content Type & Sub-Genre
Reel / Carousel / Image / IGTV. Sub-genre: tutorial / showcase / trend reaction / personal narrative / thirst-trap-bait / etc.

## One-Line Takeaway
A single sentence that captures what this post is doing differently. This is the seed for ideation."""


def _best_video_url(media: dict) -> str | None:
    versions = media.get("video_versions") or []
    if not versions:
        return None
    return max(versions, key=lambda v: v.get("width", 0) or 0).get("url")


def _best_image_url(media: dict) -> str | None:
    iv = media.get("image_versions2") or {}
    candidates = iv.get("candidates") or []
    if not candidates:
        return None
    return max(candidates, key=lambda c: c.get("width", 0) or 0).get("url")


def extract_media_urls(item: dict) -> list[tuple[str, str, str]]:
    """Return [(url, mime_type, label), ...] for an IG item."""
    media = item.get("media", item)
    media_type = media.get("media_type")
    out: list[tuple[str, str, str]] = []
    if media_type == 8:
        for i, child in enumerate(media.get("carousel_media", []) or [], 1):
            ct = child.get("media_type")
            if ct == 2:
                url = _best_video_url(child)
                if url:
                    out.append((url, "video/mp4", f"slide{i}"))
            else:
                url = _best_image_url(child)
                if url:
                    out.append((url, "image/jpeg", f"slide{i}"))
    elif media_type == 2:
        url = _best_video_url(media)
        if url:
            out.append((url, "video/mp4", "video"))
    else:
        url = _best_image_url(media)
        if url:
            out.append((url, "image/jpeg", "image"))
    return out


def download_media(url: str, dest_path: Path, timeout: int = 60) -> Path:
    headers = {"User-Agent": USER_AGENT, "Referer": "https://www.instagram.com/"}
    r = requests.get(url, headers=headers, stream=True, timeout=timeout)
    r.raise_for_status()
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(8192):
            if chunk:
                f.write(chunk)
    return dest_path


class VisionAnalyzer:
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.5-flash",
        media_dir: str | Path = "media",
        log: logging.Logger | None = None,
    ):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.media_dir = Path(media_dir)
        self.media_dir.mkdir(exist_ok=True)
        self.log = log or logging.getLogger("vision")

    def _upload_or_inline(self, path: Path, mime_type: str):
        size = path.stat().st_size
        if mime_type.startswith("video") or size > 18 * 1024 * 1024:
            file = self.client.files.upload(file=str(path))
            while getattr(file.state, "name", None) == "PROCESSING":
                time.sleep(2)
                file = self.client.files.get(name=file.name)
            if getattr(file.state, "name", None) == "FAILED":
                raise RuntimeError(f"Gemini Files API processing failed for {path}")
            return file
        with open(path, "rb") as f:
            data = f.read()
        return types.Part.from_bytes(data=data, mime_type=mime_type)

    def analyze(self, item: dict, save_pk: str, caption: str = "") -> str | None:
        """Download media + run Gemini. Returns analysis markdown, or None on failure."""
        urls = extract_media_urls(item)
        if not urls:
            self.log.warning(f"vision: no media URLs for {save_pk}")
            return None

        downloaded: list[tuple[Path, str]] = []
        for url, mime, label in urls:
            ext = "mp4" if mime.startswith("video") else "jpg"
            path = self.media_dir / f"{save_pk}_{label}.{ext}"
            try:
                download_media(url, path)
                downloaded.append((path, mime))
            except Exception as e:
                self.log.error(f"vision: download failed [{label}] for {save_pk}: {e}")

        if not downloaded:
            return None

        parts: list = []
        try:
            for path, mime in downloaded:
                parts.append(self._upload_or_inline(path, mime))
        except Exception as e:
            self.log.error(f"vision: upload failed for {save_pk}: {e}")
            return None

        prompt = VISION_PROMPT
        if caption:
            prompt += f"\n\n---\nThe author's caption (for context only — your analysis should be based primarily on the visuals/audio):\n{caption[:1500]}"
        parts.append(prompt)

        try:
            response = self.client.models.generate_content(
                model=self.model, contents=parts
            )
            return response.text
        except Exception as e:
            self.log.error(f"vision: generate_content failed for {save_pk}: {e}")
            return None

    def cleanup(self, save_pk: str) -> None:
        for f in self.media_dir.glob(f"{save_pk}_*"):
            try:
                f.unlink()
            except Exception:
                pass


def markdown_to_notion_blocks(markdown: str) -> list[dict]:
    """Convert the vision analysis markdown into Notion block dicts.

    Maps `## heading` to heading_2, `- bullet` to bulleted_list_item, otherwise
    paragraph. Splits lines >1900 chars conservatively at sentence boundaries.
    """
    blocks: list[dict] = []
    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("## "):
            blocks.append(
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {
                        "rich_text": [{"text": {"content": line[3:].strip()[:1900]}}]
                    },
                }
            )
        elif line.startswith("- ") or line.startswith("* "):
            blocks.append(
                {
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{"text": {"content": line[2:].strip()[:1900]}}]
                    },
                }
            )
        else:
            blocks.append(
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"text": {"content": line[:1900]}}]
                    },
                }
            )
    return blocks
