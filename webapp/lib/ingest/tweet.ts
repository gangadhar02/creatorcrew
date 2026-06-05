/**
 * Ingest a single X / Twitter post from a pasted permalink — the free,
 * no-auth path (the same one tweet embeds use), so it works for any PUBLIC
 * tweet without an API key or paid scraper.
 *
 *   GET https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=<derived>
 *
 * Returns text, author, likes, replies, media, and timestamp. NOTE: the free
 * endpoint does NOT include view or retweet counts — those need the X API
 * (X_BEARER_TOKEN) or a scraper, and are left null here (optional enrichment).
 *
 * Media is stored as the source pbs.twimg.com URL (Twitter media is stable and
 * the image proxy already handles twimg), matching the Instagram path — no
 * re-hosting required. Server-only.
 */
import { upsertCreator, upsertCreatorPost } from "../dual-write";
import type { IngestedPost } from "./post-by-url";

/** Pull the numeric status id out of any x.com / twitter.com permalink. */
export function parseTweetId(url: string): string | null {
  const m = url.match(/(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/i);
  return m ? m[1] : null;
}

/** Token X embeds derive from the id (no key needed). */
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

type SyndicationUser = {
  id_str?: string;
  name?: string;
  screen_name?: string;
  profile_image_url_https?: string;
  is_blue_verified?: boolean;
  verified?: boolean;
};

type SyndicationMedia = {
  media_url_https?: string;
  type?: "photo" | "video" | "animated_gif";
  video_info?: { variants?: { url?: string; content_type?: string; bitrate?: number }[] };
};

type SyndicationTweet = {
  id_str?: string;
  text?: string;
  note_tweet?: { text?: string };
  user?: SyndicationUser;
  favorite_count?: number;
  conversation_count?: number;
  created_at?: string;
  mediaDetails?: SyndicationMedia[];
  photos?: { url?: string }[];
};

async function fetchTweet(id: string): Promise<SyndicationTweet | null> {
  const token = syndicationToken(id);
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}&lang=en`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json",
    },
    // tweet content is immutable-ish; let the platform cache briefly
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as SyndicationTweet;
  if (!data || !data.id_str) return null;
  return data;
}

/**
 * Fetch a public tweet by permalink and upsert into creators + creator_posts.
 * Returns null if the tweet can't be fetched (private/removed/protected).
 */
export async function ingestTweetByUrl(
  workspaceId: string,
  url: string
): Promise<IngestedPost | null> {
  const id = parseTweetId(url);
  if (!id) return null;

  const t = await fetchTweet(id);
  if (!t || !t.user?.screen_name) return null;

  const handle = t.user.screen_name.toLowerCase();
  const media = t.mediaDetails || [];
  const hasVideo = media.some(
    (m) => m.type === "video" || m.type === "animated_gif"
  );
  const thumbnail = media[0]?.media_url_https || t.photos?.[0]?.url || null;
  // Long-form ("note") tweets carry the full body separately.
  const caption = t.note_tweet?.text || t.text || "";

  const creatorId = await upsertCreator(
    workspaceId,
    "x",
    handle,
    {
      display_name: t.user.name || handle,
      avatar_url:
        t.user.profile_image_url_https?.replace("_normal", "_400x400") || null,
      is_verified: !!(t.user.is_blue_verified || t.user.verified),
      raw_profile_json: t.user,
    },
    { discovered: true }
  );
  if (!creatorId) return null;

  const creatorPostId = await upsertCreatorPost({
    creator_id: creatorId,
    platform: "x",
    platform_pk: t.id_str!,
    code: t.id_str!,
    url: `https://x.com/${handle}/status/${t.id_str}`,
    media_type: "post",
    media_format: hasVideo ? "video" : media.length ? "image" : null,
    title_or_caption: caption,
    like_count: t.favorite_count ?? 0,
    comment_count: t.conversation_count ?? 0,
    // Free syndication endpoint omits views/retweets — omitted here, left for
    // optional X-API / Apify enrichment later.
    published_at: t.created_at || null,
    thumbnail_url: thumbnail,
    raw_json: t as unknown as Record<string, unknown>,
  });
  if (!creatorPostId) return null;

  return { creatorPostId, creatorId, handle };
}
