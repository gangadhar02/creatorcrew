"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Heart, MessageCircle, Eye } from "lucide-react";
import { igImg } from "@/lib/proxy-image";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";
import { useDocumentOverlay } from "@/components/canvas/DocumentOverlay";
import { usePostOverlay } from "@/components/canvas/PostOverlay";

export default function BoardItemTile({
  item,
  onDelete,
}: {
  item: ExpandedBoardItem;
  onDelete: (itemId: string) => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-[var(--card)] ring-1 ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.2)] transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_18px_40px_-18px_rgba(0,0,0,0.3)] dark:ring-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_10px_28px_-14px_rgba(0,0,0,0.7)]">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(item.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        data-no-drag
        title="Remove from board"
        className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80 focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {item.kind === "post" && item.creator_post && (
        <PostTile post={item.creator_post} />
      )}
      {item.kind === "post" && !item.creator_post && <LoadingTile />}
      {item.kind === "card" && item.card && (
        <CardTile cardId={item.card.id} initialBody={item.card.body_md} color={item.card.color} />
      )}
      {item.kind === "document" && item.document && (
        <DocumentTile
          documentId={item.document.id}
          title={item.document.title}
          bodyPreview={item.document.body_md}
        />
      )}
      {item.kind === "file" && item.file && (
        <FileTile fileId={item.file.id} kind={item.file.kind} name={item.file.original_name} />
      )}
      {item.tag && (
        <div className="absolute left-2 top-2 z-10 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] text-white">
          {item.tag}
        </div>
      )}
    </div>
  );
}

function LoadingTile() {
  return (
    <div className="p-3">
      <div className="aspect-[4/5] animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 text-[10px] font-mono text-[var(--muted-foreground)]">
        Fetching link…
      </div>
    </div>
  );
}

function PostTile({ post }: { post: NonNullable<ExpandedBoardItem["creator_post"]> }) {
  const postOverlay = usePostOverlay();
  return (
    <button
      type="button"
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        postOverlay.openPost({
          post,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        });
      }}
      className="block w-full text-left"
    >
      {post.thumbnail_url && (
        <div className="aspect-[4/5] bg-zinc-200 dark:bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              post.platform === "instagram"
                ? igImg(post.thumbnail_url)
                : post.thumbnail_url
            }
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-3">
        <div className="truncate text-xs font-semibold">
          {post.creator?.display_name || `@${post.creator?.handle || "unknown"}`}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" /> {fmtCount(post.like_count)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> {fmtCount(post.comment_count)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {fmtCount(post.view_count || post.play_count)}
          </span>
        </div>
        {post.title_or_caption && (
          <div className="mt-1.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
            {post.title_or_caption}
          </div>
        )}
      </div>
    </button>
  );
}

function fmtCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
}

function CardTile({
  cardId,
  initialBody,
}: {
  cardId: string;
  initialBody: string;
  color: string;
}) {
  const [body, setBody] = useState(initialBody);

  // Auto-grow to fit content (Eden text cards hug their content).
  const resize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (body === initialBody) return;
    const t = setTimeout(() => {
      fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_md: body }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [body, cardId, initialBody]);

  return (
    <div className="p-4">
      <textarea
        ref={resize}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          resize(e.target);
        }}
        placeholder="Write a quick idea or note…"
        rows={1}
        className="w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed focus:outline-none placeholder:text-[var(--muted-foreground)]/50"
      />
    </div>
  );
}

function DocumentTile({
  documentId,
  title,
  bodyPreview,
}: {
  documentId: string;
  title: string;
  bodyPreview: string;
}) {
  const { openDocument, enabled } = useDocumentOverlay();

  const preview = plainTextPreview(bodyPreview);
  const inner = (
    <>
      <div className="mb-1.5 text-base font-semibold leading-snug">
        {title || "Untitled"}
      </div>
      {preview ? (
        <div className="line-clamp-[8] whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted-foreground)]">
          {preview}
        </div>
      ) : (
        <div className="text-xs text-[var(--muted-foreground)]/40">
          Empty document
        </div>
      )}
    </>
  );

  if (enabled) {
    return (
      <button
        type="button"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          openDocument({
            documentId,
            title,
            body_md: bodyPreview,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          });
        }}
        className="flex aspect-[210/297] w-full flex-col overflow-hidden p-4 text-left transition-colors hover:bg-[var(--border)]/10"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={`/documents/${documentId}`}
      className="flex aspect-[210/297] w-full flex-col overflow-hidden p-4 transition-colors hover:bg-[var(--border)]/10"
    >
      {inner}
    </Link>
  );
}

/** Strip common markdown syntax so a card preview reads as clean prose. */
function plainTextPreview(md: string): string {
  return (md || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*>\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function FileTile({
  fileId,
  kind,
  name,
}: {
  fileId: string;
  kind: string;
  name: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (kind === "image") {
      fetch(`/api/files/${fileId}/signed-url`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setUrl(d?.url || null))
        .catch(() => {});
    }
  }, [fileId, kind]);

  if (kind === "image" && url) {
    return (
      <div className="aspect-[4/5] bg-zinc-200 dark:bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name || ""} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="p-3 min-h-[140px] flex items-center justify-center text-center">
      <div>
        <div className="text-3xl mb-2">{kind === "pdf" ? "📄" : "📎"}</div>
        <div className="text-xs font-medium truncate max-w-[200px]">
          {name || "file"}
        </div>
        <a
          href="#"
          onClick={async (e) => {
            e.preventDefault();
            const r = await fetch(`/api/files/${fileId}/signed-url`);
            const d = await r.json();
            if (d.url) window.open(d.url, "_blank");
          }}
          className="mt-2 inline-block text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          download ↓
        </a>
      </div>
    </div>
  );
}
