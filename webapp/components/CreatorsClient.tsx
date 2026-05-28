"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";

type ListRow = { id: string; name: string; color: string };

export default function CreatorsClient({
  lists,
  memberCounts,
  activeListId,
  totalCreators,
  listsView = false,
}: {
  lists: ListRow[];
  memberCounts: Record<string, number>;
  activeListId: string | null;
  totalCreators: number;
  listsView?: boolean;
}) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  async function addCreator(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: handle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setHandle("");
      // For YouTube + Substack, the resolved handle may differ from the input
      // (e.g. URL → derived handle). Use the response handle if available.
      const finalHandle = (data.handle || handle.replace(/^@/, "")).toLowerCase();
      if (platform === "instagram" || platform === "x" || platform === "twitter") {
        const p = platform === "twitter" ? "x" : platform;
        router.push(`/creators/${p}/${finalHandle}`);
      }
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(false);
    }
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await fetch("/api/creator-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      if (res.ok) {
        setNewListName("");
        router.refresh();
      }
    } finally {
      setCreatingList(false);
    }
  }

  const totalCount = totalCreators;

  return (
    <div className="space-y-3">
      {/* Add-creator form — hidden on My Lists tab to keep focus on list management */}
      {!listsView && (
      <form
        onSubmit={addCreator}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
      >
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          disabled={adding}
          className="rounded-md border border-[var(--border)] bg-transparent px-2 py-2 text-sm"
        >
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="substack">Substack</option>
          <option value="x">X / Twitter</option>
        </select>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={
            platform === "instagram"
              ? "@username or username"
              : platform === "youtube"
                ? "@handle, channel URL, or UC… id"
                : platform === "x"
                  ? "@username, handle, or x.com/… URL"
                  : "publication, publication.substack.com, or URL"
          }
          disabled={adding}
          className="flex-1 min-w-[200px] rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={adding || !handle.trim()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {adding ? "Analyzing… (30-90s)" : "Add creator"}
        </button>
        {error && (
          <div className="basis-full text-xs text-rose-600 dark:text-rose-400 mt-1">
            {error}
          </div>
        )}
      </form>
      )}

      {/* List tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href="/creators"
          className={clsx(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            activeListId === null && !listsView
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          All Following · {totalCount}
        </Link>
        {lists.map((l) => (
          <Link
            key={l.id}
            href={`/creators?list=${l.id}`}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              activeListId === l.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {l.name} · {memberCounts[l.id] || 0}
          </Link>
        ))}
        <form onSubmit={createList} className="flex items-center gap-1">
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="+ New list"
            disabled={creatingList}
            className="rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
          {newListName.trim() && (
            <button
              type="submit"
              disabled={creatingList}
              className="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              {creatingList ? "…" : "✓"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
