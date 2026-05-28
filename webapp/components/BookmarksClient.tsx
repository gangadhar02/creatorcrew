"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, LayoutGrid, Grid3x3 } from "lucide-react";
import type { BookmarkItem } from "@/lib/types-bookmarks";
import BookmarksCanvas from "./BookmarksCanvas";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_TAGS_VALUE = "__all_bookmark_tags__";

export default function BookmarksClient({
  initialItems,
  schemaReady,
}: {
  initialItems: BookmarkItem[];
  schemaReady: boolean;
}) {
  const [items, setItems] = useState<BookmarkItem[]>(initialItems);
  const [syncing, setSyncing] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // Bump to force the canvas to remount and re-run its initial fitView.
  // Used after "Reset to grid" so the camera snaps to the new layout.
  const [canvasKey, setCanvasKey] = useState(0);

  const tags = Array.from(
    new Set(
      items
        .flatMap((i) => (Array.isArray(i.tags) ? i.tags : []))
        .filter(Boolean)
    )
  ).sort();

  const tagCounts = new Map(
    tags.map((tag) => [
      tag,
      items.filter((i) => Array.isArray(i.tags) && i.tags.includes(tag))
        .length,
    ])
  );

  const visible = activeTag
    ? items.filter((i) => Array.isArray(i.tags) && i.tags.includes(activeTag))
    : items;

  const persistPosition = useCallback(async (id: string, x: number, y: number) => {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, x, y } : it)));
    try {
      await fetch(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const handleUpdate = useCallback(
    (id: string, patch: Partial<BookmarkItem>) => {
      setItems((arr) =>
        arr.map((it) => (it.id === id ? { ...it, ...patch } : it))
      );
    },
    []
  );

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
    setItems((arr) => arr.filter((it) => it.id !== id));
    toast.success("Removed from canvas");
  }, []);

  async function syncBookmarks() {
    if (!schemaReady) {
      toast.error("Bookmarks table missing. Run docs/bookmarks-schema.sql in Supabase SQL editor, then refresh.");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/bookmarks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPerPlatform: 60, autoTag: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      const listRes = await fetch("/api/bookmarks");
      const listData = await listRes.json();
      setItems(listData.items || []);

      const parts = [
        data.instagram?.count ? `${data.instagram.count} IG` : null,
        data.instagram?.mediaEnriched
          ? `${data.instagram.mediaEnriched} with media`
          : null,
        data.x?.count ? `${data.x.count} X` : null,
        data.tagged ? `${data.tagged} tagged` : null,
      ].filter(Boolean);
      toast.success(parts.length ? `Synced ${parts.join(", ")}` : "Sync complete");

      if (data.instagram?.warning) toast.warning(`Instagram: ${data.instagram.warning}`);
      if (data.x?.warning) toast.warning(`X: ${data.x.warning}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function relayout() {
    setSyncing(true);
    try {
      const res = await fetch("/api/bookmarks/layout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Layout failed");
      }
      const listRes = await fetch("/api/bookmarks");
      const listData = await listRes.json();
      setItems(listData.items || []);
      toast.success("Re-arranged by tags");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function resetGrid() {
    setSyncing(true);
    try {
      const res = await fetch("/api/bookmarks/reset-layout", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");

      // Clear the saved camera so the canvas re-fits to the new grid.
      try {
        window.localStorage.removeItem("bookmarks-canvas-camera:v1");
      } catch {
        /* ignore */
      }

      const listRes = await fetch("/api/bookmarks");
      const listData = await listRes.json();
      setItems(listData.items || []);
      setCanvasKey((k) => k + 1);
      toast.success(`Reset ${data.updated} bookmarks to 5-column grid`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4 animate-page-in">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={syncBookmarks} disabled={syncing}>
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync bookmarks
        </Button>
        <Button
          variant="outline"
          onClick={relayout}
          disabled={syncing || items.length === 0}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          Auto-arrange
        </Button>
        <Button
          variant="outline"
          onClick={resetGrid}
          disabled={syncing || items.length === 0}
          title="Reflow all bookmarks into a clean 5-column grid in newest-first order. Overrides any existing positions."
        >
          <Grid3x3 className="mr-2 h-4 w-4" />
          Reset to grid
        </Button>
        <span className="text-xs text-muted-foreground">
          IG: personal cookies · X: auth_token + ct0 · Tags: Gemini Flash
        </span>
        {tags.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {visible.length} / {items.length}
            </span>
            <Select
              value={activeTag ?? ALL_TAGS_VALUE}
              onValueChange={(value) =>
                setActiveTag(value === ALL_TAGS_VALUE ? null : value)
              }
            >
              <SelectTrigger
                aria-label="Filter bookmarks by tag"
                size="sm"
                className="w-[240px] bg-background sm:w-[280px]"
              >
                <SelectValue placeholder="Filter tags">
                  {(value) =>
                    value === ALL_TAGS_VALUE
                      ? `All bookmarks (${items.length})`
                      : `${value} (${tagCounts.get(value) ?? 0})`
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="max-h-80">
                <SelectGroup>
                  <SelectLabel>Filter by tag</SelectLabel>
                  <SelectItem value={ALL_TAGS_VALUE}>
                    All bookmarks ({items.length})
                  </SelectItem>
                  <SelectSeparator />
                  {tags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag} ({tagCounts.get(tag) ?? 0})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!schemaReady && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Run{" "}
          <code className="text-xs">docs/bookmarks-schema.sql</code> in your
          Supabase SQL editor, then refresh this page.
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>No bookmarks on the canvas yet.</p>
          <p className="mt-2 text-xs">
            Click Sync to pull saved posts from Instagram and X, auto-tag with
            Gemini, and arrange by topic.
          </p>
        </div>
      ) : (
        <BookmarksCanvas
          key={canvasKey}
          items={visible}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onPositionChange={persistPosition}
          forceMasonry={canvasKey > 0}
        />
      )}
    </div>
  );
}
