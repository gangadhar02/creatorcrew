"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AddToListMenu({
  creatorId,
  lists,
  initialListIds,
  triggerLabel,
}: {
  creatorId: string;
  lists: { id: string; name: string }[];
  initialListIds: string[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memberOf, setMemberOf] = useState<Set<string>>(
    new Set(initialListIds)
  );
  const [pending, setPending] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  async function toggle(listId: string) {
    const isMember = memberOf.has(listId);
    setPending(listId);
    try {
      if (isMember) {
        await fetch(`/api/creator-lists/${listId}/members?creator_id=${creatorId}`, {
          method: "DELETE",
        });
        const next = new Set(memberOf);
        next.delete(listId);
        setMemberOf(next);
      } else {
        await fetch(`/api/creator-lists/${listId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creator_id: creatorId }),
        });
        const next = new Set(memberOf);
        next.add(listId);
        setMemberOf(next);
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs shadow-sm hover:border-primary/40 transition-colors"
      >
        {triggerLabel || "Add to list"} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Lists
          </div>
          {lists.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
              No lists yet. Create one from /creators.
            </div>
          ) : (
            <div className="py-1 max-h-60 overflow-y-auto">
              {lists.map((l) => {
                const isMember = memberOf.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    disabled={pending === l.id}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-[var(--border)]/30 disabled:opacity-50"
                  >
                    <span>{l.name}</span>
                    {isMember ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
