/**
 * Ingest a single X / Twitter post from a pasted permalink — no API key, no
 * paid scraper, works for any PUBLIC tweet.
 *
 * Primary source: FxTwitter (api.fxtwitter.com) — a free public JSON API that
 * returns the FULL text (incl. long-form "note" tweets), media, AND the full
 * metric set (likes, retweets, replies, views).
 * Fallback: X's own embed syndication endpoint (cdn.syndication.twimg.com) —
 * free too, but truncates long-form tweets and omits views/retweets.
 *
 * Media is stored as the source pbs.twimg.com URL (Twitter media is stable and
 * the image proxy already handles twimg), matching the Instagram path. The
 * provider's raw tweet JSON is kept in raw_json so the card can render extras
 * (retweet count, multi-image grid). Server-only.
 */
import { upsertCreator, upsertCreatorPost } from "../dual-write";
import type { IngestedPost } from "./post-by-url";

/** Pull the numeric status id out of any x.com / twitter.com permalink. */
export function parseTweetId(url: string): string | null {
  const m = url.match(/(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/i);
  return m ? m[1] : null;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Common shape both providers map into. */
type NormalizedTweet = {
  id: string;
  handle: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  text: string;
  likes: number;
  retweets: number | null;
  replies: number;
  views: number | null;
  createdISO: string | null;
  media: string[]; // image URLs (or video posters)
  hasVideo: boolean;
  raw: unknown; // provider's raw tweet object (kept in raw_json)
};

// ---- Primary: FxTwitter ----
type FxMedia = { type?: string; url?: string; thumbnail_url?: string };
type FxTweet = {
  id?: string;
  text?: string;
  author?: { screen_name?: string; name?: string; avatar_url?: string; verification?: string | null };
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  created_timestamp?: number;
  media?: { all?: FxMedia[]; photos?: { url?: string }[] };
};

async function fetchFromFx(id: string): Promise<NormalizedTweet | null> {
  let res: Response;
  try {
    res = await fetch(`https://api.fxtwitter.com/_/status/${id}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 300 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { code?: number; tweet?: FxTweet } | null;
  const t = data?.tweet;
  if (!t || !t.author?.screen_name) return null;

  const all = t.media?.all || [];
  const photos = (t.media?.photos || []).map((p) => p.url).filter((u): u is string => !!u);
  const allImgs = all
    .map((m) => (m.type === "photo" ? m.url : m.thumbnail_url))
    .filter((u): u is string => !!u);
  const media = photos.length ? photos : allImgs;
  const hasVideo = all.some((m) => m.type === "video" || m.type === "gif");

  return {
    id: t.id || id,
    handle: t.author.screen_name.toLowerCase(),
    name: t.author.name || t.author.screen_name,
    avatar: t.author.avatar_url?.replace(/_(normal|200x200)\./, "_400x400.") || null,
    verified: !!t.author.verification,
    text: t.text || "",
    likes: t.likes ?? 0,
    retweets: t.retweets ?? null,
    replies: t.replies ?? 0,
    views: typeof t.views === "number" ? t.views : null,
    createdISO: t.created_timestamp
      ? new Date(t.created_timestamp * 1000).toISOString()
      : null,
    media,
    hasVideo,
    raw: t,
  };
}

// ---- Fallback: X syndication ----
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

type SynMedia = { media_url_https?: string; type?: string };
type SynTweet = {
  id_str?: string;
  text?: string;
  note_tweet?: { text?: string };
  user?: { name?: string; screen_name?: string; profile_image_url_https?: string; is_blue_verified?: boolean; verified?: boolean };
  favorite_count?: number;
  conversation_count?: number;
  created_at?: string;
  mediaDetails?: SynMedia[];
};

async function fetchFromSyndication(id: string): Promise<NormalizedTweet | null> {
  let res: Response;
  try {
    res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}&lang=en`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: 300 } }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const t = (await res.json().catch(() => null)) as SynTweet | null;
  if (!t || !t.id_str || !t.user?.screen_name) return null;

  const md = t.mediaDetails || [];
  return {
    id: t.id_str,
    handle: t.user.screen_name.toLowerCase(),
    name: t.user.name || t.user.screen_name,
    avatar: t.user.profile_image_url_https?.replace("_normal", "_400x400") || null,
    verified: !!(t.user.is_blue_verified || t.user.verified),
    // note_tweet.text is usually empty in the free endpoint; t.text may be truncated.
    text: t.note_tweet?.text || t.text || "",
    likes: t.favorite_count ?? 0,
    retweets: null,
    replies: t.conversation_count ?? 0,
    views: null,
    createdISO: t.created_at || null,
    media: md.map((m) => m.media_url_https).filter((u): u is string => !!u),
    hasVideo: md.some((m) => m.type === "video" || m.type === "animated_gif"),
    raw: t,
  };
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

  const nt = (await fetchFromFx(id)) || (await fetchFromSyndication(id));
  if (!nt) return null;

  const creatorId = await upsertCreator(
    workspaceId,
    "x",
    nt.handle,
    {
      display_name: nt.name,
      avatar_url: nt.avatar,
      is_verified: nt.verified,
      raw_profile_json: nt.raw,
    },
    { discovered: true }
  );
  if (!creatorId) return null;

  const creatorPostId = await upsertCreatorPost({
    creator_id: creatorId,
    platform: "x",
    platform_pk: nt.id,
    code: nt.id,
    url: `https://x.com/${nt.handle}/status/${nt.id}`,
    media_type: "post",
    media_format: nt.hasVideo ? "video" : nt.media.length ? "image" : null,
    title_or_caption: nt.text,
    like_count: nt.likes,
    comment_count: nt.replies,
    ...(nt.views != null ? { view_count: nt.views } : {}),
    ...(nt.views && nt.views > 0
      ? {
          engagement_rate:
            Math.round(
              ((nt.likes + nt.replies + (nt.retweets ?? 0)) / nt.views) * 10000
            ) / 100,
        }
      : {}),
    published_at: nt.createdISO,
    thumbnail_url: nt.media[0] || null,
    raw_json: nt.raw as Record<string, unknown>,
  });
  if (!creatorPostId) return null;

  return { creatorPostId, creatorId, handle: nt.handle };
}
