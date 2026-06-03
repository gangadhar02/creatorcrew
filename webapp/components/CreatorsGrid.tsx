"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { igImg } from "@/lib/proxy-image";
import type { Creator } from "@/lib/types";
import CreatorCardActions from "@/components/CreatorCardActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Client-side grid for /creators. Adds a "Select" mode toggle:
 *   - Off (default): cards are clickable Links to /creators/[platform]/[handle].
 *     Trash icon shows on hover for one-off deletes (CreatorCardActions).
 *   - On: cards become click-to-select; a floating action bar at the
 *     bottom shows the count + Delete + Cancel.
 */
export default function CreatorsGrid({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allSelected = useMemo(
    () => creators.length > 0 && selected.size === creators.length,
    [creators.length, selected.size]
  );

  function enterSelect() {
    setSelectMode(true);
    setSelected(new Set());
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(creators.map((c) => c.id)));
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    const ok = window.confirm(
      `Remove ${selected.size} creator${selected.size === 1 ? "" : "s"} from your workspace?\n\nThis also deletes their cached posts and any list memberships. Cannot be undone.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/creators/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const removed = data.deleted ?? 0;
      const skipped = data.skipped ?? 0;
      toast.success(
        `Removed ${removed} creator${removed === 1 ? "" : "s"}` +
          (skipped > 0 ? ` (${skipped} skipped, not in your workspace)` : "")
      );
      exitSelect();
      router.refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Header row: select toggle + count */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          {selectMode ? (
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              {allSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {allSelected
                ? `Deselect all (${creators.length})`
                : `Select all (${creators.length})`}
            </button>
          ) : (
            <span>
              {creators.length} creator{creators.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {!selectMode ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={enterSelect}
            disabled={creators.length === 0}
          >
            <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            Select
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={exitSelect}
            disabled={deleting}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {creators.map((c) => {
          const isSelected = selected.has(c.id);
          const cardContent = (
            <>
              <div className="flex items-start gap-3">
                {c.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      c.platform === "instagram"
                        ? igImg(c.avatar_url)
                        : c.avatar_url
                    }
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--border)]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium truncate text-sm">
                      {c.display_name || `@${c.handle}`}
                    </div>
                    {c.is_verified && (
                      <span className="text-xs text-sky-500">✓</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] truncate">
                    {c.platform} · @{c.handle}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <Stat label="followers" value={c.follower_count} />
                <Stat label="reel views" value={c.typical_reel_views} />
                <Stat label="post likes" value={c.typical_post_likes} />
              </div>
            </>
          );

          return (
            <div
              key={c.id}
              className={cn(
                "group relative rounded-lg border bg-card transition-colors card-hover",
                selectMode && isSelected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/40"
              )}
            >
              {/* Selection checkbox (select mode only) */}
              {selectMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(c.id);
                  }}
                  className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-md bg-card/95 backdrop-blur-sm shadow-sm"
                  aria-label={isSelected ? "Deselect" : "Select"}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}

              {/* Single-card trash (default mode only) */}
              {!selectMode && (
                <CreatorCardActions creatorId={c.id} handle={c.handle} />
              )}

              {selectMode ? (
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="block w-full p-4 text-left"
                >
                  {cardContent}
                </button>
              ) : (
                <Link
                  href={`/creators/${c.platform}/${c.handle}`}
                  className="block p-4"
                >
                  {cardContent}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating action bar — only when in select mode AND something is selected. */}
      {selectMode && selected.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-lg border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm">
          <span className="text-sm">
            <strong>{selected.size}</strong> selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={exitSelect}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Delete {selected.size}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function fmtNum(n: number | null | undefined): string {
  if (!n) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div>
      <div className="text-[var(--muted-foreground)]">{label}</div>
      <div className="font-medium tabular-nums">{fmtNum(value)}</div>
    </div>
  );
}
