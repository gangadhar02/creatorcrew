/**
 * Instagram keyword search ingest — pulls reels/posts from any public account
 * via IG web search. Uses the scraping/dummy account (ig_scrape_* cookies).
 *
 * Server-only.
 */
import {
  searchInstagramMedia,
  normalizePost,
  computeEngagementRate,
  IGSessionInvalid,
  IGRateLimited,
  type IGMediaItem,
} from "../instagram";
import { isScrapeAccountConfigured, igCookieRefreshHint } from "../ig-config";
import {
  upsertCreator,
  upsertCreatorPost,
} from "../dual-write";

function authorFromMedia(item: IGMediaItem): {
  handle: string;
  igUserId: string | null;
} {
  const user = item.user;
  return {
    handle: (user?.username || "unknown").toLowerCase(),
    igUserId: user?.pk ? String(user.pk) : null,
  };
}

export async function searchInstagramByKeyword(
  query: string,
  workspaceId: string,
  opts: { maxResults?: number } = {}
): Promise<{ ingested: number; warning?: string }> {
  const q = query.trim();
  if (!q) return { ingested: 0 };

  let items: IGMediaItem[];
  try {
    items = await searchInstagramMedia(q, {
      maxResults: opts.maxResults ?? 25,
    });
  } catch (e) {
    if (e instanceof IGSessionInvalid) {
      return {
        ingested: 0,
        warning: `${e.message} ${igCookieRefreshHint("scraping")}`,
      };
    }
    if (e instanceof IGRateLimited) {
      return { ingested: 0, warning: String(e.message) };
    }
    return { ingested: 0, warning: String(e) };
  }

  if (items.length === 0) {
    return {
      ingested: 0,
      warning: isScrapeAccountConfigured()
        ? undefined
        : "Add ig_scrape_* cookies (dummy account) to config.json so scraping does not use your SaveSync account.",
    };
  }

  // Scope ingest to the searching workspace — NOT getDefaultWorkspaceId(),
  // which returns the oldest workspace and leaks results across accounts.
  const wsId = workspaceId;
  if (!wsId) throw new Error("No workspace configured");

  const creatorCache = new Map<string, string>();
  let ingested = 0;

  for (const item of items) {
    const normalized = normalizePost(item);
    if (!normalized) continue;

    const { handle, igUserId } = authorFromMedia(item);
    let creatorId = creatorCache.get(handle);
    if (!creatorId) {
      creatorId =
        (await upsertCreator(wsId, "instagram", handle, {
          display_name: item.user?.username || handle,
          ig_user_id: igUserId,
          last_synced_at: new Date().toISOString(),
          sync_status: "idle",
        })) || "";
      if (creatorId) creatorCache.set(handle, creatorId);
    }
    if (!creatorId) continue;

    const postId = await upsertCreatorPost({
      creator_id: creatorId,
      platform: "instagram",
      platform_pk: normalized.media_pk,
      code: normalized.code,
      url: normalized.url,
      media_type: normalized.type,
      title_or_caption: normalized.caption || null,
      like_count: normalized.like_count,
      comment_count: normalized.comment_count,
      view_count: normalized.view_count,
      play_count: normalized.play_count,
      engagement_rate: computeEngagementRate(normalized),
      outlier_multiplier: null,
      published_at: normalized.taken_at,
      thumbnail_url: normalized.thumbnail_url,
      raw_json: item as unknown as Record<string, unknown>,
    });
    if (postId) ingested += 1;
  }

  return { ingested };
}
