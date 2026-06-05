"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { bookmarkVideoUrl } from "@/lib/bookmark-media-parse";
import { mediaAsset, mediaImg } from "@/lib/proxy-image";
import type { BookmarkItem } from "@/lib/types-bookmarks";
import { cn } from "@/lib/utils";

export default function BookmarkCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: BookmarkItem;
  onUpdate: (patch: Partial<BookmarkItem>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(item.notes_md);
  const [tagsText, setTagsText] = useState(item.tags.join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    try {
      await fetch(`/api/bookmarks/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes_md: notes, tags }),
      });
      onUpdate({ notes_md: notes, tags });
    } finally {
      setSaving(false);
    }
  }

  const thumb = item.thumbnail_url
    ? mediaImg(item.thumbnail_url, item.platform)
    : null;

  const videoSrc = useMemo(() => {
    const v = bookmarkVideoUrl(item);
    return v ? mediaAsset(v, item.platform) : null;
  }, [item]);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  function openOriginal() {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  function openOriginalFromKeyboard(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openOriginal();
  }

  async function onMediaEnter() {
    const el = videoRef.current;
    if (!el) return;
    try {
      el.muted = true;
      el.playsInline = true;
      await el.play();
    } catch {
      // Ignore autoplay/gesture errors.
    }
  }

  function onMediaLeave() {
    const el = videoRef.current;
    if (!el) return;
    try {
      el.pause();
    } catch {
      // Ignore.
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-card ring-1 ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.2)] transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_18px_40px_-18px_rgba(0,0,0,0.3)] dark:ring-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_10px_28px_-14px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            item.platform === "instagram"
              ? "text-pink-600"
              : "text-foreground"
          )}
        >
          {item.platform === "instagram" ? "IG" : "𝕏"}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-[10px] text-destructive hover:underline"
          >
            Remove
          </button>
        </div>
      </div>

      {!thumb && !videoSrc && (
        <div
          className={cn(
            "flex items-center justify-center bg-muted text-center px-3",
            item.platform === "instagram" ? "aspect-[4/5]" : "h-32"
          )}
        >
          <p className="text-[10px] text-muted-foreground">
            Click <span className="font-medium">Sync bookmarks</span> to load
            preview
          </p>
        </div>
      )}

      {(thumb || videoSrc) && (
        <div
          className={cn(
            "bg-muted cursor-pointer nodrag",
            item.platform === "instagram" ? "aspect-[4/5]" : "max-h-56 overflow-hidden"
          )}
          onClick={openOriginal}
          onMouseEnter={onMediaEnter}
          onMouseLeave={onMediaLeave}
          onKeyDown={openOriginalFromKeyboard}
          role="button"
          tabIndex={0}
          aria-label={`Open original bookmark from @${
            item.author_handle || "unknown"
          }`}
        >
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              poster={thumb || undefined}
              controls
              playsInline
              muted
              preload="metadata"
              className={cn(
                "h-full w-full",
                item.platform === "instagram" ? "object-cover" : "object-contain"
              )}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb || ""}
              alt=""
              className={cn(
                "h-full w-full",
                item.platform === "instagram" ? "object-cover" : "object-cover"
              )}
            />
          )}
        </div>
      )}

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-2"
      >
        <p className="text-xs font-medium truncate">
          @{item.author_handle || "unknown"}
        </p>
        <p className="mt-1 line-clamp-4 text-xs text-muted-foreground whitespace-pre-wrap">
          {item.caption || ""}
        </p>
      </a>

      <div className="space-y-2 border-t border-border p-2">
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          onBlur={save}
          placeholder="tags, comma-separated"
          className="w-full rounded border border-border bg-transparent px-2 py-1 text-[11px] nodrag"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          placeholder="Your notes…"
          rows={3}
          className="w-full resize-none rounded border border-border bg-transparent px-2 py-1 text-[11px] nodrag"
        />
      </div>
    </div>
  );
}
