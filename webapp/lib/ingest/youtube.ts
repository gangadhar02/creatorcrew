/**
 * YouTube Data API v3 ingestor.
 *
 * Reads YOUTUBE_API_KEY from the environment. Free quota is 10k units/day,
 * which is plenty for personal-scale (each channel sync is ~50–100 units).
 *
 * Flow:
 *   1. Resolve handle → channelId (channels.list with forHandle param)
 *   2. Fetch channel metadata (snippet, statistics, contentDetails)
 *   3. Read uploads playlist via playlistItems.list (paginated)
 *   4. Fetch video stats in batches of 50 via videos.list (statistics + contentDetails)
 *   5. Compute median views → outlier multiplier
 *   6. Upsert creator + creator_posts
 *
 * Server-only.
 */
import { upsertCreator, upsertCreatorPost } from "../dual-write";

const API_BASE = "https://www.googleapis.com/youtube/v3";

type YTChannel = {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    thumbnails?: { high?: { url: string }; default?: { url: string } };
  };
  statistics: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
  };
  contentDetails: {
    relatedPlaylists: { uploads: string };
  };
};

type YTPlaylistItem = {
  contentDetails: { videoId: string; videoPublishedAt?: string };
  snippet: { title: string; description: string };
};

type YTVideo = {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails?: { maxres?: { url: string }; high?: { url: string }; default?: { url: string } };
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails: { duration: string };
};

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) {
    throw new Error(
      "YOUTUBE_API_KEY not set. Add it to .env.local (get one at https://console.cloud.google.com/apis/credentials)."
    );
  }
  return k;
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey() }).toString();
  const r = await fetch(`${API_BASE}/${path}?${qs}`, { cache: "no-store" });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`YouTube API ${path} ${r.status}: ${body.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

/**
 * Resolve a YouTube handle/username/URL to a channel record.
 * Supports inputs: `@handle`, `handle`, `UCxxxxxx` (channel id), or full URL.
 */
export async function resolveChannel(input: string): Promise<YTChannel> {
  const raw = input.trim();
  // Pull a handle out of a full URL if user pasted one.
  let candidate = raw;
  const urlMatch = raw.match(
    /youtube\.com\/(?:@([\w.\-]+)|channel\/(UC[\w\-]+)|c\/([\w\-]+)|user\/([\w\-]+))/i
  );
  if (urlMatch) {
    candidate = urlMatch[1] || urlMatch[2] || urlMatch[3] || urlMatch[4] || raw;
  }
  candidate = candidate.replace(/^@/, "");

  // 1. Try direct channel ID
  if (/^UC[\w\-]{20,}$/.test(candidate)) {
    const r = await yt<{ items?: YTChannel[] }>("channels", {
      part: "snippet,statistics,contentDetails",
      id: candidate,
    });
    if (r.items?.[0]) return r.items[0];
  }
  // 2. Try forHandle (works for @handles)
  {
    const r = await yt<{ items?: YTChannel[] }>("channels", {
      part: "snippet,statistics,contentDetails",
      forHandle: candidate,
    });
    if (r.items?.[0]) return r.items[0];
  }
  // 3. Try forUsername (legacy)
  {
    const r = await yt<{ items?: YTChannel[] }>("channels", {
      part: "snippet,statistics,contentDetails",
      forUsername: candidate,
    });
    if (r.items?.[0]) return r.items[0];
  }
  // 4. Fall back to search.list
  {
    const r = await yt<{ items?: { id: { channelId: string } }[] }>("search", {
      part: "id",
      q: candidate,
      type: "channel",
      maxResults: "1",
    });
    const channelId = r.items?.[0]?.id?.channelId;
    if (channelId) {
      const r2 = await yt<{ items?: YTChannel[] }>("channels", {
        part: "snippet,statistics,contentDetails",
        id: channelId,
      });
      if (r2.items?.[0]) return r2.items[0];
    }
  }
  throw new Error(`YouTube channel not found for "${input}"`);
}

async function listUploadVideoIds(
  uploadsPlaylistId: string,
  maxVideos: number
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < maxVideos) {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, maxVideos - ids.length)),
    };
    if (pageToken) params.pageToken = pageToken;
    const r = await yt<{ items?: YTPlaylistItem[]; nextPageToken?: string }>(
      "playlistItems",
      params
    );
    for (const it of r.items || []) ids.push(it.contentDetails.videoId);
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return ids.slice(0, maxVideos);
}

async function fetchVideos(ids: string[]): Promise<YTVideo[]> {
  const out: YTVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const r = await yt<{ items?: YTVideo[] }>("videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    });
    out.push(...(r.items || []));
  }
  return out;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * ISO 8601 duration (PT1H2M30S) → seconds. Returns 0 if unparseable.
 */
function parseISODuration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (
    (parseInt(m[1] || "0", 10) || 0) * 3600 +
    (parseInt(m[2] || "0", 10) || 0) * 60 +
    (parseInt(m[3] || "0", 10) || 0)
  );
}

export type YouTubeIngestResult = {
  channelId: string;
  handle: string;
  display_name: string;
  posts_cached: number;
  typical_views: number;
};

export async function ingestYouTubeChannel(
  input: string,
  workspaceId: string,
  opts: { maxVideos?: number } = {}
): Promise<YouTubeIngestResult> {
  const wsId = workspaceId;
  if (!wsId) throw new Error("No workspace configured");
  const maxVideos = Math.max(1, Math.min(opts.maxVideos ?? 50, 200));

  const channel = await resolveChannel(input);
  const handle = (channel.snippet.customUrl || channel.id)
    .replace(/^@/, "")
    .toLowerCase();
  const avatar =
    channel.snippet.thumbnails?.high?.url ||
    channel.snippet.thumbnails?.default?.url ||
    null;

  const videoIds = await listUploadVideoIds(
    channel.contentDetails.relatedPlaylists.uploads,
    maxVideos
  );
  const videos = await fetchVideos(videoIds);
  const viewCounts = videos
    .map((v) => Number(v.statistics.viewCount || 0))
    .filter((n) => n > 0);
  const typicalViews = median(viewCounts);

  const creatorId = await upsertCreator(wsId, "youtube", handle, {
    display_name: channel.snippet.title,
    bio: channel.snippet.description?.slice(0, 4000) || null,
    follower_count: Number(channel.statistics.subscriberCount || 0),
    post_count: Number(channel.statistics.videoCount || 0),
    avatar_url: avatar,
    is_verified: false,
    last_synced_at: new Date().toISOString(),
    sync_status: "idle",
    raw_profile_json: channel as unknown as Record<string, unknown>,
  });
  if (!creatorId) throw new Error("Failed to upsert creator");

  for (const v of videos) {
    const views = Number(v.statistics.viewCount || 0);
    const likes = Number(v.statistics.likeCount || 0);
    const comments = Number(v.statistics.commentCount || 0);
    const dur = parseISODuration(v.contentDetails.duration);
    const isShort = dur > 0 && dur <= 60;
    const outlier =
      typicalViews > 0 ? Math.round((views / typicalViews) * 100) / 100 : null;
    const engagement =
      views > 0 ? Math.round(((likes + comments) / views) * 10000) / 100 : null;
    const thumb =
      v.snippet.thumbnails?.maxres?.url ||
      v.snippet.thumbnails?.high?.url ||
      v.snippet.thumbnails?.default?.url ||
      null;

    await upsertCreatorPost({
      creator_id: creatorId,
      platform: "youtube",
      platform_pk: v.id,
      code: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      media_type: isShort ? "Short" : "Video",
      title_or_caption: v.snippet.title,
      like_count: likes,
      comment_count: comments,
      view_count: views,
      engagement_rate: engagement,
      outlier_multiplier: outlier,
      published_at: v.snippet.publishedAt,
      thumbnail_url: thumb,
      raw_json: v as unknown as Record<string, unknown>,
    });
  }

  return {
    channelId: channel.id,
    handle,
    display_name: channel.snippet.title,
    posts_cached: videos.length,
    typical_views: typicalViews,
  };
}

type YTSearchItem = {
  id: { videoId: string };
  snippet: {
    channelId: string;
    channelTitle: string;
    title: string;
    publishedAt: string;
    thumbnails?: {
      maxres?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
};

/**
 * Search YouTube by keyword and ingest matching videos (any channel).
 */
export async function searchYouTubeByKeyword(
  query: string,
  workspaceId: string,
  opts: { maxResults?: number } = {}
): Promise<{ ingested: number; warning?: string }> {
  if (!process.env.YOUTUBE_API_KEY) {
    return { ingested: 0, warning: "YOUTUBE_API_KEY not set" };
  }

  // Scope ingest to the searching workspace — NOT getDefaultWorkspaceId(),
  // which returns the oldest workspace and leaks results across accounts.
  const wsId = workspaceId;
  if (!wsId) throw new Error("No workspace configured");

  const maxResults = Math.max(1, Math.min(opts.maxResults ?? 25, 50));
  const searchRes = await yt<{ items?: YTSearchItem[] }>("search", {
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    order: "relevance",
  });

  const items = searchRes.items || [];
  if (items.length === 0) return { ingested: 0 };

  const videoIds = items.map((i) => i.id.videoId).filter(Boolean);
  const videos = await fetchVideos(videoIds);
  const videoById = new Map(videos.map((v) => [v.id, v]));

  let ingested = 0;
  const creatorCache = new Map<string, string>();

  for (const item of items) {
    const videoId = item.id.videoId;
    const v = videoById.get(videoId);
    if (!v) continue;

    const channelId = item.snippet.channelId;
    let creatorId = creatorCache.get(channelId);
    if (!creatorId) {
      const handle = channelId.toLowerCase();
      creatorId =
        (await upsertCreator(
          wsId,
          "youtube",
          handle,
          {
            display_name: item.snippet.channelTitle,
            last_synced_at: new Date().toISOString(),
            sync_status: "idle",
          },
          { discovered: true }
        )) || "";
      if (creatorId) creatorCache.set(channelId, creatorId);
    }
    if (!creatorId) continue;

    const views = Number(v.statistics.viewCount || 0);
    const likes = Number(v.statistics.likeCount || 0);
    const comments = Number(v.statistics.commentCount || 0);
    const dur = parseISODuration(v.contentDetails.duration);
    const isShort = dur > 0 && dur <= 60;
    const engagement =
      views > 0
        ? Math.round(((likes + comments) / views) * 10000) / 100
        : null;
    const thumb =
      item.snippet.thumbnails?.maxres?.url ||
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.default?.url ||
      v.snippet.thumbnails?.maxres?.url ||
      v.snippet.thumbnails?.high?.url ||
      null;

    const postId = await upsertCreatorPost({
      creator_id: creatorId,
      platform: "youtube",
      platform_pk: videoId,
      code: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      media_type: isShort ? "Short" : "Video",
      title_or_caption: v.snippet.title || item.snippet.title,
      like_count: likes,
      comment_count: comments,
      view_count: views,
      engagement_rate: engagement,
      outlier_multiplier: null,
      published_at: v.snippet.publishedAt || item.snippet.publishedAt,
      thumbnail_url: thumb,
      raw_json: v as unknown as Record<string, unknown>,
    });
    if (postId) ingested += 1;
  }

  return { ingested };
}
