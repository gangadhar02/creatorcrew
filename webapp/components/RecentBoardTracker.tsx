"use client";

import { useEffect } from "react";

const KEY = "eden.recentBoards:v1";
const MAX = 8;

/**
 * Drop into a board detail page to record it in localStorage so the ⌘K
 * palette can surface it under "Recent".
 */
export default function RecentBoardTracker({
  boardId,
  name,
}: {
  boardId: string;
  name: string;
}) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      const list = raw
        ? (JSON.parse(raw) as { id: string; name: string; at: number }[])
        : [];
      const filtered = list.filter((b) => b.id !== boardId);
      const next = [{ id: boardId, name, at: Date.now() }, ...filtered].slice(
        0,
        MAX
      );
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [boardId, name]);

  return null;
}
