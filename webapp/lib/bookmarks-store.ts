/**
 * Supabase persistence for bookmark_items.
 *
 * Server-only.
 */
import { getSupabase } from "./supabase";
import { getDefaultWorkspaceId } from "./dual-write";
import type { BookmarkDraft, BookmarkItem } from "./types-bookmarks";
import { autoLayoutBookmarks } from "./bookmark-layout";

export async function listBookmarks(
  workspaceId: string
): Promise<BookmarkItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("bookmark_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("saved_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data || []) as BookmarkItem[];
}

export async function upsertBookmarkDrafts(
  workspaceId: string,
  drafts: BookmarkDraft[]
): Promise<{ upserted: number; ids: string[] }> {
  const sb = getSupabase();
  const ids: string[] = [];
  let upserted = 0;

  for (const d of drafts) {
    const { data, error } = await sb
      .from("bookmark_items")
      .upsert(
        {
          workspace_id: workspaceId,
          platform: d.platform,
          external_id: d.external_id,
          url: d.url,
          author_handle: d.author_handle ?? null,
          author_name: d.author_name ?? null,
          caption: d.caption ?? null,
          thumbnail_url: d.thumbnail_url ?? null,
          media_type: d.media_type ?? null,
          saved_at: d.saved_at ?? null,
          raw_json: d.raw_json ?? null,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,platform,external_id" }
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (data as { id: string }).id;
    ids.push(id);
    upserted += 1;
  }

  return { upserted, ids };
}

export async function applyTagsAndLayout(
  workspaceId: string,
  tagMap: Map<string, string[]>
): Promise<void> {
  const items = await listBookmarks(workspaceId);
  for (const item of items) {
    const newTags = tagMap.get(item.id);
    if (newTags?.length) item.tags = newTags;
  }

  const positions = autoLayoutBookmarks(items);
  const sb = getSupabase();

  for (const item of items) {
    const pos = positions.get(item.id);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (tagMap.has(item.id)) patch.tags = item.tags;
    if (pos) {
      patch.x = pos.x;
      patch.y = pos.y;
    }
    await sb.from("bookmark_items").update(patch).eq("id", item.id);
  }
}

export async function syncAllBookmarks(opts: {
  maxPerPlatform?: number;
  autoTag?: boolean;
}): Promise<{
  instagram: { count: number; mediaEnriched?: number; warning?: string };
  x: { count: number; warning?: string };
  tagged: number;
}> {
  const wsId = await getDefaultWorkspaceId();
  if (!wsId) throw new Error("No workspace configured");

  const { fetchInstagramSavedPosts } = await import("./ig-bookmarks");
  const { fetchXBookmarks } = await import("./x-bookmarks");

  const max = opts.maxPerPlatform ?? 60;
  const [ig, xRes] = await Promise.all([
    fetchInstagramSavedPosts({ maxItems: max }),
    fetchXBookmarks({ maxItems: max }),
  ]);

  const all = [...ig.items, ...xRes.items];
  await upsertBookmarkDrafts(wsId, all);

  let tagged = 0;
  if (opts.autoTag !== false && all.length > 0 && process.env.GEMINI_API_KEY) {
    const items = await listBookmarks(wsId);
    const untagged = items.filter((i) => i.tags.length === 0);
    if (untagged.length > 0) {
      const { tagBookmarksWithGemini } = await import("./bookmark-tagging");
      const tagMap = await tagBookmarksWithGemini(untagged);
      await applyTagsAndLayout(wsId, tagMap);
      tagged = tagMap.size;
    } else {
      await applyTagsAndLayout(wsId, new Map());
    }
  }

  return {
    instagram: {
      count: ig.items.length,
      mediaEnriched: ig.mediaEnriched,
      warning: ig.warning,
    },
    x: { count: xRes.items.length, warning: xRes.warning },
    tagged,
  };
}
