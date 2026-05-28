/**
 * Fetch Instagram bookmarks for the canvas.
 *
 * We source this from the already-working SaveSync pipeline (`sync.py` → `saves` table),
 * instead of re-scraping IG's saved feed on-demand (which frequently fails with 400s).
 *
 * Server-only.
 */
import { enrichInstagramBookmarkDrafts, thumbFromRaw } from "./bookmark-media";
import { getSupabase } from "./supabase";
import type { BookmarkDraft } from "./types-bookmarks";

export async function fetchInstagramSavedPosts(
  opts: { maxItems?: number } = {}
): Promise<{
  items: BookmarkDraft[];
  mediaEnriched?: number;
  warning?: string;
}> {
  const maxItems = Math.max(1, Math.min(opts.maxItems ?? 120, 500));
  const sb = getSupabase();

  const { data, error } = await sb
    .from("saves")
    .select("media_pk, url, type, author, caption, collection_name, saved_at, ig_raw_json")
    .order("saved_at", { ascending: false })
    .limit(maxItems);

  if (error) return { items: [], warning: error.message };

  const items: BookmarkDraft[] = (data || []).map((s: any) => ({
    platform: "instagram",
    external_id: String(s.media_pk),
    url: String(s.url),
    author_handle: s.author ? String(s.author).toLowerCase() : null,
    author_name: s.author ? String(s.author) : null,
    caption: s.caption || null,
    thumbnail_url: thumbFromRaw(s.ig_raw_json || null),
    media_type: s.type || null,
    saved_at: s.saved_at || null,
    raw_json: hasUsableRaw(s.ig_raw_json) ? s.ig_raw_json : null,
  }));

  const enrich = await enrichInstagramBookmarkDrafts(items, {
    max: maxItems,
  });

  const warning = enrich.warning
    ? enrich.warning
    : enrich.failed > 0
      ? `${enrich.failed} IG items could not load media (rate limit or private).`
      : undefined;

  return {
    items,
    mediaEnriched: enrich.enriched,
    warning,
  };
}

function hasUsableRaw(raw: unknown): raw is Record<string, unknown> {
  return (
    !!raw &&
    typeof raw === "object" &&
    Object.keys(raw as object).length > 0
  );
}
