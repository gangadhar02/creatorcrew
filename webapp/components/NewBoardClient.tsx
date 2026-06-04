"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Board } from "@/lib/types-boards";

/**
 * When `template` is supplied, renders a template card that creates a new
 * board copying the template's name/description/icon/color. Otherwise renders
 * a "+ New board" button with a small inline form.
 */
export default function NewBoardClient({ template }: { template?: Board }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template?.name || "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(boardName: string, fromTemplate?: Board) {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: boardName,
          description: fromTemplate?.description,
          color: fromTemplate?.color,
          copy_from_template_id: fromTemplate?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/boards/${data.board.id}`);
      router.refresh();
    } catch (e) {
      setError(String(e));
      setCreating(false);
    }
  }

  if (template) {
    return (
      <button
        onClick={() => create(template.name, template)}
        disabled={creating}
        className="block w-full text-left rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)] disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 shrink-0 rounded grid place-items-center text-sm bg-[var(--border)]">
            {template.icon || "📋"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{template.name}</div>
            {template.description && (
              <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)] line-clamp-2">
                {template.description}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 text-[10px] text-[var(--muted-foreground)] tabular-nums">
          {creating ? "creating…" : "use template →"}
        </div>
      </button>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
      >
        + New board
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create(name.trim());
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Board name"
        disabled={creating}
        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={creating || !name.trim()}
        className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {creating ? "…" : "Create"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setName("");
        }}
        className="text-xs text-[var(--muted-foreground)]"
      >
        ✕
      </button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </form>
  );
}
