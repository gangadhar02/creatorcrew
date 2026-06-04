"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { igImg } from "@/lib/proxy-image";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";

export default function BoardItemTile({
  item,
  onDelete,
}: {
  item: ExpandedBoardItem;
  onDelete: (itemId: string) => void;
}) {
  return (
    <div className="group relative rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <button
        onClick={() => onDelete(item.id)}
        title="Remove from board"
        className="absolute right-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
      {item.kind === "post" && item.creator_post && (
        <PostTile post={item.creator_post} />
      )}
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

function PostTile({ post }: { post: NonNullable<ExpandedBoardItem["creator_post"]> }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
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
      <div className="p-2">
        <div className="text-xs font-medium truncate">
          @{post.creator?.handle || "unknown"}
        </div>
        <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
          {post.title_or_caption || ""}
        </div>
      </div>
    </a>
  );
}

function CardTile({
  cardId,
  initialBody,
  color,
}: {
  cardId: string;
  initialBody: string;
  color: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (body === initialBody) {
      setSaved(true);
      return;
    }
    setSaved(false);
    const t = setTimeout(async () => {
      await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_md: body }),
      });
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [body, cardId, initialBody]);

  const bg: Record<string, string> = {
    yellow: "bg-amber-100 dark:bg-amber-900/20",
    green: "bg-emerald-100 dark:bg-emerald-900/20",
    blue: "bg-sky-100 dark:bg-sky-900/20",
    pink: "bg-pink-100 dark:bg-pink-900/20",
    gray: "bg-zinc-100 dark:bg-zinc-800",
  };

  return (
    <div className={"p-3 min-h-[140px] " + (bg[color] || bg.gray)}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a quick idea or note…"
        rows={6}
        className="w-full resize-none bg-transparent text-sm focus:outline-none placeholder:text-[var(--muted-foreground)]"
      />
      <div className="mt-2 text-[10px] text-[var(--muted-foreground)] font-mono">
        Card {saved ? "✓" : "saving…"}
      </div>
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
  return (
    <Link
      href={`/documents/${documentId}`}
      className="block p-3 min-h-[140px] transition-colors hover:bg-[var(--border)]/20"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">📄</span>
        <div className="font-medium text-sm truncate flex-1">
          {title || "Untitled"}
        </div>
      </div>
      <div className="text-xs text-[var(--muted-foreground)] line-clamp-5">
        {bodyPreview || "(empty document, click to open)"}
      </div>
      <div className="mt-2 text-[10px] text-[var(--muted-foreground)] font-mono">
        Document → open to edit
      </div>
    </Link>
  );
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
