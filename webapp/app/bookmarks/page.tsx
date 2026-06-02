import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import BookmarksClient from "@/components/BookmarksClient";
import type { BookmarkItem } from "@/lib/types-bookmarks";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const ws = await getWorkspaceContext();
  let items: BookmarkItem[] = [];
  let schemaReady = true;
  let canvasState: unknown = null;

  if (ws.workspaceId) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("bookmark_items")
      .select("*")
      .eq("workspace_id", ws.workspaceId)
      .order("saved_at", { ascending: false, nullsFirst: false });

    if (error) {
      if (
        error.message.includes("bookmark_items") ||
        error.code === "42P01"
      ) {
        schemaReady = false;
      }
    } else {
      items = (data || []) as BookmarkItem[];
    }

    // tldraw canvas snapshot (migration_022). Table may not exist yet — ignore.
    const { data: canvasRow } = await sb
      .from("bookmark_canvas")
      .select("canvas_state")
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();
    canvasState = canvasRow?.canvas_state ?? null;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bookmarks canvas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Sync your Instagram and X bookmarks, auto-tag with Gemini, and arrange
          them on an infinite canvas. Drag cards, edit notes and tags on each
          card.
        </p>
      </header>
      <BookmarksClient
        initialItems={items}
        schemaReady={schemaReady}
        initialCanvasState={canvasState}
      />
    </div>
  );
}
