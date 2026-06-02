/**
 * X (Twitter) API v2 ingestor.
 *
 * Env: X_BEARER_TOKEN — app-only Bearer token from developer.x.com
 *
 * Server-only.
 */
import { upsertCreator, upsertCreatorPost } from "../dual-write";
import {
  getUserByUsername,
  getUserTweets,
  searchRecentTweets,
  mediaByKey,
  usersById,
  tweetThumbnail,
  tweetMediaType,
  parseXHandle,
  xConfigured,
  type XTweet,
  type XUser,
} from "../x-client";

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function engagementFromMetrics(m?: {
  like_count?: number;
  reply_count?: number;
  impression_count?: number;
}): number | null {
  const views = m?.impression_count || 0;
  const likes = m?.like_count || 0;
  const replies = m?.reply_count || 0;
  if (views <= 0) return null;
  return Math.round(((likes + replies) / views) * 10000) / 100;
}

async function upsertTweetsForCreator(
  creatorId: string,
  handle: string,
  tweets: XTweet[],
  includes: Awaited<ReturnType<typeof getUserTweets>>["includes"],
  typicalLikes: number
): Promise<number> {
  const mediaMap = mediaByKey(includes);
  let ingested = 0;

  for (const t of tweets) {
    const metrics = t.public_metrics;
    const likes = metrics?.like_count || 0;
    const replies = metrics?.reply_count || 0;
    const views = metrics?.impression_count || 0;
    const outlier =
      typicalLikes > 0
        ? Math.round((likes / typicalLikes) * 100) / 100
        : null;
    const fmt = tweetMediaType(t, mediaMap);

    const postId = await upsertCreatorPost({
      creator_id: creatorId,
      platform: "x",
      platform_pk: t.id,
      code: t.id,
      url: `https://x.com/${handle}/status/${t.id}`,
      media_type: "post",
      media_format: fmt,
      title_or_caption: t.text,
      like_count: likes,
      comment_count: replies,
      view_count: views,
      engagement_rate: engagementFromMetrics(metrics),
      outlier_multiplier: outlier,
      published_at: t.created_at || null,
      thumbnail_url: tweetThumbnail(t, mediaMap),
      raw_json: t as unknown as Record<string, unknown>,
    });
    if (postId) ingested += 1;
  }

  return ingested;
}

export type XIngestResult = {
  handle: string;
  display_name: string;
  posts_cached: number;
  typical_likes: number;
};

/** Fetch a user's recent posts and upsert into creators + creator_posts. */
export async function ingestXUser(
  input: string,
  workspaceId: string,
  opts: { maxPosts?: number } = {}
): Promise<XIngestResult> {
  if (!xConfigured()) {
    throw new Error(
      "X_BEARER_TOKEN not set. Add your app Bearer token to .env.local — https://developer.x.com"
    );
  }

  const wsId = workspaceId;
  if (!wsId) throw new Error("No workspace configured");

  const maxPosts = Math.max(5, Math.min(opts.maxPosts ?? 50, 100));
  const user = await getUserByUsername(input);
  const handle = user.username.toLowerCase();

  const timeline = await getUserTweets(user.id, { maxResults: maxPosts });
  const tweets = timeline.data || [];
  const likeCounts = tweets
    .map((t) => t.public_metrics?.like_count || 0)
    .filter((n) => n > 0);
  const typicalLikes = median(likeCounts);

  const creatorId = await upsertCreator(wsId, "x", handle, {
    display_name: user.name,
    bio: user.description?.slice(0, 4000) || null,
    follower_count: user.public_metrics?.followers_count ?? null,
    following_count: user.public_metrics?.following_count ?? null,
    post_count: user.public_metrics?.tweet_count ?? null,
    avatar_url: user.profile_image_url?.replace("_normal", "_400x400") || null,
    is_verified: !!user.verified,
    last_synced_at: new Date().toISOString(),
    sync_status: "idle",
    raw_profile_json: user as unknown as Record<string, unknown>,
  });
  if (!creatorId) throw new Error("Failed to upsert creator");

  const postsCached = await upsertTweetsForCreator(
    creatorId,
    handle,
    tweets,
    timeline.includes,
    typicalLikes
  );

  return {
    handle,
    display_name: user.name,
    posts_cached: postsCached,
    typical_likes: typicalLikes,
  };
}

/** Search X by keyword and ingest tweets from any author. */
export async function searchXByKeyword(
  query: string,
  workspaceId: string,
  opts: { maxResults?: number } = {}
): Promise<{ ingested: number; warning?: string }> {
  const q = query.trim();
  if (!q) return { ingested: 0 };

  if (!xConfigured()) {
    return {
      ingested: 0,
      warning: "X_BEARER_TOKEN not set — add Bearer token from developer.x.com",
    };
  }

  // Scope ingest to the searching workspace — NOT getDefaultWorkspaceId(),
  // which returns the oldest workspace and leaks results across accounts.
  const wsId = workspaceId;
  if (!wsId) throw new Error("No workspace configured");

  const maxResults = Math.max(10, Math.min(opts.maxResults ?? 25, 100));

  let res: Awaited<ReturnType<typeof searchRecentTweets>>;
  try {
    // -is:retweet drops pure RTs; lang:en optional — keep query user-controlled
    res = await searchRecentTweets(`${q} -is:retweet`, { maxResults });
  } catch (e) {
    return { ingested: 0, warning: String(e) };
  }

  const tweets = res.data || [];
  if (tweets.length === 0) return { ingested: 0 };

  const userMap = usersById(res.includes);
  const mediaMap = mediaByKey(res.includes);
  const creatorCache = new Map<string, string>();
  let ingested = 0;

  for (const t of tweets) {
    const authorId = t.author_id;
    const author: XUser | undefined = authorId
      ? userMap.get(authorId)
      : undefined;
    const handle = (author?.username || "unknown").toLowerCase();
    if (handle === "unknown") continue;

    let creatorId = creatorCache.get(handle);
    if (!creatorId) {
      creatorId =
        (await upsertCreator(wsId, "x", handle, {
          display_name: author?.name || handle,
          avatar_url:
            author?.profile_image_url?.replace("_normal", "_400x400") || null,
          is_verified: !!author?.verified,
          follower_count: author?.public_metrics?.followers_count ?? null,
          last_synced_at: new Date().toISOString(),
          sync_status: "idle",
        })) || "";
      if (creatorId) creatorCache.set(handle, creatorId);
    }
    if (!creatorId) continue;

    const metrics = t.public_metrics;
    const likes = metrics?.like_count || 0;
    const replies = metrics?.reply_count || 0;
    const views = metrics?.impression_count || 0;
    const fmt = tweetMediaType(t, mediaMap);

    const postId = await upsertCreatorPost({
      creator_id: creatorId,
      platform: "x",
      platform_pk: t.id,
      code: t.id,
      url: `https://x.com/${handle}/status/${t.id}`,
      media_type: "post",
      media_format: fmt,
      title_or_caption: t.text,
      like_count: likes,
      comment_count: replies,
      view_count: views,
      engagement_rate: engagementFromMetrics(metrics),
      outlier_multiplier: null,
      published_at: t.created_at || null,
      thumbnail_url: tweetThumbnail(t, mediaMap),
      raw_json: t as unknown as Record<string, unknown>,
    });
    if (postId) ingested += 1;
  }

  return { ingested };
}

export { parseXHandle };
