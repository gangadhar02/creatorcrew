/**
 * Server-side IG media enrichment for bookmarks sync.
 */
import {
  fetchMediaByPk,
  IGSessionInvalid,
  type IGAccount,
  type IGMediaItem,
} from "./instagram";
import {
  hasUsableIgRaw,
  thumbFromRaw,
  videoFromRaw,
} from "./bookmark-media-parse";
import type { BookmarkDraft } from "./types-bookmarks";

export { hasUsableIgRaw, thumbFromRaw, videoFromRaw } from "./bookmark-media-parse";

export function thumbFromIgMedia(item: IGMediaItem): string | null {
  const candidates = item.image_versions2?.candidates || [];
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a));
    return best.url;
  }
  const videos = item.video_versions || [];
  if (videos.length > 0) {
    const best = videos.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a));
    return best.url;
  }
  return null;
}

export async function enrichInstagramBookmarkDrafts(
  items: BookmarkDraft[],
  opts: {
    max?: number;
    account?: IGAccount;
    delayMs?: number;
  } = {}
): Promise<{
  enriched: number;
  failed: number;
  warning?: string;
}> {
  const account = opts.account ?? "personal";
  const max = Math.max(1, Math.min(opts.max ?? 60, 120));
  const delayMs = opts.delayMs ?? 350;

  const targets = items.filter(
    (i) =>
      i.platform === "instagram" &&
      !i.thumbnail_url &&
      !thumbFromRaw(i.raw_json ?? null)
  );

  let enriched = 0;
  let failed = 0;
  let warning: string | undefined;

  for (const draft of targets.slice(0, max)) {
    try {
      const media = await fetchMediaByPk(draft.external_id, account);
      draft.thumbnail_url = thumbFromIgMedia(media);
      draft.raw_json = media as unknown as Record<string, unknown>;
      enriched += 1;
    } catch (e) {
      failed += 1;
      if (e instanceof IGSessionInvalid) {
        warning = e.message;
        break;
      }
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  return { enriched, failed, warning };
}
