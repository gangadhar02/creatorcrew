"use client";

import Link from "next/link";
import { igImg } from "@/lib/proxy-image";
import type { Board } from "@/lib/types-boards";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";

export default function BoardPaneContent({
  board,
  items,
}: {
  board: Board;
  items: ExpandedBoardItem[];
}) {
  return (
    <div className="space-y-3">
      {board.description && (
        <p className="text-xs text-[var(--muted-foreground)]">{board.description}</p>
      )}
      <Link
        href={`/boards/${board.id}`}
        className="block rounded-md bg-[var(--primary)] px-3 py-1.5 text-center text-xs font-medium text-[var(--primary-foreground)]"
      >
        Open full board ↗
      </Link>
      <div className="grid grid-cols-2 gap-2">
        {items.length === 0 && (
          <div className="col-span-2 rounded-md border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted-foreground)]">
            No items in this board yet.
          </div>
        )}
        {items.map((it) => (
          <BoardItemTile key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}

function BoardItemTile({ item }: { item: ExpandedBoardItem }) {
  if (item.kind === "post" && item.creator_post) {
    const p = item.creator_post;
    return (
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-square overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)]"
      >
        {p.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              p.platform === "instagram"
                ? igImg(p.thumbnail_url)
                : p.thumbnail_url
            }
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-[10px] text-[var(--muted-foreground)]">
            {p.title_or_caption?.slice(0, 40) || "post"}
          </div>
        )}
      </a>
    );
  }
  if (item.kind === "card" && item.card) {
    return (
      <div className="aspect-square rounded-md border border-[var(--border)] bg-amber-50 p-2 text-[10px] text-zinc-900 dark:bg-amber-900/20 dark:text-amber-100">
        {item.card.body_md.slice(0, 120)}
      </div>
    );
  }
  if (item.kind === "document" && item.document) {
    return (
      <Link
        href={`/documents/${item.document.id}`}
        className="block aspect-square rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-[10px]"
      >
        <div className="font-medium">📄 {item.document.title}</div>
        <div className="mt-1 line-clamp-5 text-[var(--muted-foreground)]">
          {item.document.body_md.slice(0, 120)}
        </div>
      </Link>
    );
  }
  if (item.kind === "file" && item.file) {
    return (
      <div className="aspect-square rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-[10px]">
        <div className="font-medium">
          {item.file.kind === "image"
            ? "🖼"
            : item.file.kind === "pdf"
              ? "📕"
              : "📎"}{" "}
          {item.file.original_name || "file"}
        </div>
      </div>
    );
  }
  return null;
}
