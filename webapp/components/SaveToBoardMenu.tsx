"use client";

import { useEffect, useRef, useState } from "react";
import type { Board } from "@/lib/types-boards";

export default function SaveToBoardMenu({
  creatorPostId,
  onClose,
}: {
  creatorPostId: string;
  onClose: () => void;
}) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/boards")
      .then((r) => r.json())
      .then((d) => setBoards((d.boards || []) as Board[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function saveTo(boardId: string) {
    setBusy(boardId);
    try {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "post", creator_post_id: creatorPostId }),
      });
      if (res.ok) {
        const next = new Set(done);
        next.add(boardId);
        setDone(next);
      }
    } finally {
      setBusy(null);
    }
  }

  async function createAndSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.board) {
        const created = data.board as Board;
        setBoards((b) => [created, ...b]);
        setNewName("");
        await saveTo(created.id);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-3 top-10 z-30 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
    >
      <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
        Save to board
      </div>
      <div className="py-1 max-h-72 overflow-y-auto">
        {boards.length === 0 && (
          <div className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
            No boards yet. Create one below.
          </div>
        )}
        {boards.map((b) => {
          const isDone = done.has(b.id);
          return (
            <button
              key={b.id}
              onClick={() => saveTo(b.id)}
              disabled={busy !== null || isDone}
              className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-[var(--border)]/30 disabled:opacity-60"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span>{b.icon || "📋"}</span>
                <span className="truncate">{b.name}</span>
              </span>
              {isDone ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  ✓
                </span>
              ) : busy === b.id ? (
                <span className="text-[var(--muted-foreground)]">…</span>
              ) : (
                <span className="text-[var(--muted-foreground)]">+</span>
              )}
            </button>
          );
        })}
      </div>
      <form
        onSubmit={createAndSave}
        className="flex items-center gap-1 border-t border-[var(--border)] px-2 py-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="+ New board"
          disabled={creating}
          className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30 disabled:opacity-50"
        />
        {newName.trim() && (
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-[var(--primary)] px-2 py-1 text-xs text-[var(--primary-foreground)]"
          >
            {creating ? "…" : "+ save"}
          </button>
        )}
      </form>
    </div>
  );
}
