"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Board } from "@/lib/types-boards";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";
import BoardItemTile from "./BoardItemTile";
import BoardCanvas from "./board/BoardCanvas";
import type { TLStoreSnapshot } from "tldraw";

export default function BoardClient({
  board,
  initialItems,
}: {
  board: Board;
  initialItems: ExpandedBoardItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<ExpandedBoardItem[]>(initialItems);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "canvas">(() => {
    if (typeof window === "undefined") return "canvas";
    return (
      (window.localStorage.getItem(`board-view:${board.id}`) as
        | "grid"
        | "canvas") || "canvas"
    );
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync the item list when the server re-renders after router.refresh()
  // (add post/card/document/file). Tile layout lives in the tldraw snapshot,
  // not here, so replacing the list just adds/removes which tiles exist.
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function switchView(v: "grid" | "canvas") {
    setViewMode(v);
    try {
      window.localStorage.setItem(`board-view:${board.id}`, v);
    } catch {
      /* ignore */
    }
  }

  // Compute available tags
  const tags = Array.from(
    new Set(items.map((i) => i.tag).filter((t): t is string => !!t))
  );

  const visibleItems = activeTag
    ? items.filter((i) => i.tag === activeTag)
    : items;

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Avoid hijacking when user is typing in inputs/textareas/contentEditable
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const editable =
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (editable) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        // ⌘V is handled by the global paste listener below
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        addCard();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        addDocument();
      }
    }
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editable =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable;
      if (editable) return;
      // Pastes inside the tldraw canvas are handled by the canvas itself
      // (BoardCanvas.onPasteUrl) — don't double-add here.
      if (target?.closest?.(".tl-container")) return;
      const text = e.clipboardData?.getData("text") || "";
      if (text.startsWith("http")) {
        e.preventDefault();
        addPostByUrl(text.trim());
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addCard() {
    setBusy("card");
    try {
      const res = await fetch(`/api/boards/${board.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "card", body_md: "", tag: activeTag }),
      });
      const data = await res.json();
      if (res.ok) router.refresh();
      else alert(`Failed: ${data.error}`);
    } finally {
      setBusy(null);
    }
  }

  async function addDocument() {
    setBusy("document");
    try {
      const res = await fetch(`/api/boards/${board.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "document",
          title: "Untitled",
          body_md: "",
          voice_id: board.voice_id,
          tag: activeTag,
        }),
      });
      const data = await res.json();
      if (res.ok) router.refresh();
      else alert(`Failed: ${data.error}`);
    } finally {
      setBusy(null);
    }
  }

  async function addPostByUrl(url: string) {
    setBusy("post");
    try {
      const res = await fetch(`/api/boards/${board.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "post", url, tag: activeTag }),
      });
      const data = await res.json();
      if (res.ok) router.refresh();
      else alert(`Couldn't add: ${data.error}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy("file");
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.append("file", f);
      const upRes = await fetch("/api/files/upload", {
        method: "POST",
        body: form,
      });
      const upData = await upRes.json();
      if (!upRes.ok) {
        alert(`Upload failed: ${upData.error}`);
        continue;
      }
      await fetch(`/api/boards/${board.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "file",
          file_id: upData.file.id,
          tag: activeTag,
        }),
      });
    }
    setBusy(null);
    router.refresh();
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Remove this item from the board?")) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await fetch(`/api/board-items/${itemId}`, { method: "DELETE" });
    router.refresh();
  }

  // Drag-drop file uploads on the whole board area
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="space-y-4"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded grid place-items-center text-base bg-[var(--border)]">
            {board.icon || "📋"}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">{board.name}</h1>
            {board.description && (
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {board.description}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-xs">
          <button
            className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--border)]/30 opacity-50 cursor-not-allowed"
            disabled
            title="Phase 10"
          >
            Chat
          </button>
          <button
            className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--border)]/30 opacity-50 cursor-not-allowed"
            disabled
            title="Coming soon"
          >
            Share
          </button>
        </div>
      </header>

      {/* Sub-tag tabs */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag(null)}
            className={
              activeTag === null
                ? "rounded-full px-3 py-1 text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "rounded-full px-3 py-1 text-xs border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }
          >
            All ({items.length})
          </button>
          {tags.map((t) => {
            const count = items.filter((i) => i.tag === t).length;
            return (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className={
                  activeTag === t
                    ? "rounded-full px-3 py-1 text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "rounded-full px-3 py-1 text-xs border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1 align-middle" />
                {t} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Add panel */}
      {items.length === 0 ? (
        <EmptyAddPanel
          onAddCard={addCard}
          onAddDocument={addDocument}
          onFiles={handleFiles}
          busy={busy}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={addCard}
            disabled={busy !== null}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--border)]/30 disabled:opacity-50"
          >
            + Card <kbd className="ml-1 opacity-60">C</kbd>
          </button>
          <button
            onClick={addDocument}
            disabled={busy !== null}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--border)]/30 disabled:opacity-50"
          >
            + Document <kbd className="ml-1 opacity-60">D</kbd>
          </button>
          <label className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--border)]/30 cursor-pointer">
            + File
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
          <span className="text-[var(--muted-foreground)]">
            Paste a URL (⌘V) · Drag-drop files anywhere
          </span>
        </div>
      )}

      {/* View mode + Items render */}
      {visibleItems.length > 0 && (
        <>
          <div className="flex items-center gap-1 text-[10px]">
            <button
              onClick={() => switchView("canvas")}
              className={
                viewMode === "canvas"
                  ? "rounded-md bg-primary px-2 py-1 text-primary-foreground"
                  : "rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              Canvas
            </button>
            <button
              onClick={() => switchView("grid")}
              className={
                viewMode === "grid"
                  ? "rounded-md bg-primary px-2 py-1 text-primary-foreground"
                  : "rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              Grid
            </button>
          </div>
          {viewMode === "canvas" ? (
            <BoardCanvas
              boardId={board.id}
              items={visibleItems}
              initialSnapshot={
                (board.canvas_state as TLStoreSnapshot | null) ?? null
              }
              onDelete={deleteItem}
            />
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((item) => (
                <BoardItemTile key={item.id} item={item} onDelete={deleteItem} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyAddPanel({
  onAddCard,
  onAddDocument,
  onFiles,
  busy,
}: {
  onAddCard: () => void;
  onAddDocument: () => void;
  onFiles: (f: FileList | null) => void;
  busy: string | null;
}) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-sm">Add To This Board</div>
      </div>
      <div className="space-y-1.5 text-sm">
        <ShortcutRow label="Paste a link" keys={["⌘", "V"]} />
        <ShortcutRow label="Start a document" keys={["D"]} onClick={onAddDocument} />
        <ShortcutRow label="Jot quick ideas or drafts" keys={["C"]} onClick={onAddCard} />
        <label className="flex items-center justify-between rounded-md p-2 hover:bg-[var(--border)]/30 cursor-pointer">
          <span>Drop images, PDFs, or files</span>
          <span className="text-[10px] text-[var(--muted-foreground)] font-mono">DRAG</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        <ShortcutRow
          label="Save top performing content"
          keys={["DISCOVER"]}
          href="/discover"
        />
        <ShortcutRow label="Save an AI chat response" keys={["CHAT"]} />
      </div>
      {busy && (
        <div className="mt-3 text-xs text-[var(--muted-foreground)]">Adding {busy}…</div>
      )}
    </div>
  );
}

function ShortcutRow({
  label,
  keys,
  onClick,
  href,
}: {
  label: string;
  keys: string[];
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <span className="flex items-center gap-0.5">
        {keys.map((k) => (
          <kbd
            key={k}
            className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted-foreground)]"
          >
            {k}
          </kbd>
        ))}
      </span>
    </>
  );
  const className =
    "flex items-center justify-between rounded-md p-2 hover:bg-[var(--border)]/30 cursor-pointer";
  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={`w-full text-left ${className}`}>
      {content}
    </button>
  );
}
