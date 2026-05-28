/**
 * Instagram web-API client for scraping features (Profile Analyzer, Discover
 * search, creator ingest). Uses the scraping/dummy account by default — see
 * lib/ig-config.ts. SaveSync (Python sync.py) uses personal cookies directly.
 *
 * Server-only.
 */
import {
  getIGCookies,
  igCookieRefreshHint,
  type IGAccount,
} from "./ig-config";

export type { IGAccount };

const IG_BASE = "https://www.instagram.com/api/v1";
const IG_APP_ID = "936619743392459";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function igHeaders(account: IGAccount = "scraping"): Record<string, string> {
  const { sessionId, csrfToken, userId } = getIGCookies(account);
  return {
    "User-Agent": USER_AGENT,
    "X-IG-App-ID": IG_APP_ID,
    "X-CSRFToken": csrfToken,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://www.instagram.com/",
    Cookie: `sessionid=${sessionId}; csrftoken=${csrfToken}; ds_user_id=${userId}`,
  };
}

export class IGSessionInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IGSessionInvalid";
  }
}

export class IGRateLimited extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IGRateLimited";
  }
}

/**
 * Retry schedule for transient failures (429s and 5xx). Kept short so user-
 * facing route handlers don't block past Next.js's maxDuration. Background
 * jobs that can wait longer should call igFetch in a wrapper of their own.
 */
const RETRY_DELAYS_MS = [30_000, 90_000]; // 30s, 1m30s — total ~2 min

export async function igFetch<T = unknown>(
  url: string,
  account: IGAccount = "scraping"
): Promise<T> {
  let lastBody = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const r = await fetch(url, {
      headers: igHeaders(account),
      cache: "no-store",
    });
    if (r.ok) return (await r.json()) as T;

    if (r.status === 401 || r.status === 403) {
      throw new IGSessionInvalid(
        `IG returned ${r.status}. ${igCookieRefreshHint(account)}`
      );
    }

    const body = await r.text().catch(() => "");
    lastBody = body;
    const lowerBody = body.toLowerCase();
    // IG sometimes returns 400 with CSRF / token mismatch when cookies are stale.
    if (
      r.status === 400 &&
      (lowerBody.includes("csrf") ||
        lowerBody.includes("token") ||
        lowerBody.includes("submit") ||
        lowerBody.includes("mismatch"))
    ) {
      throw new IGSessionInvalid(
        `IG returned 400 (likely stale cookies). ${igCookieRefreshHint(account)}`
      );
    }
    const isRateLimit = r.status === 429;
    const isServerError = r.status >= 500;
    const shouldRetry = (isRateLimit || isServerError) && attempt < RETRY_DELAYS_MS.length;

    if (!shouldRetry) {
      if (isRateLimit) {
        throw new IGRateLimited(
          `IG rate-limited (429) after ${attempt + 1} attempts. Try again in a few minutes.`
        );
      }
      throw new Error(`IG HTTP ${r.status}: ${body.slice(0, 200)}`);
    }

    const delay = RETRY_DELAYS_MS[attempt];
    console.warn(
      `[igFetch] ${r.status} on ${url.slice(0, 80)} — retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${delay / 1000}s`
    );
    await new Promise((res) => setTimeout(res, delay));
  }
  // Shouldn't reach here, but TS needs a return
  throw new Error(`IG fetch exhausted retries: ${lastBody.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// Types matching the IG web API shapes (just the fields we use)
// ---------------------------------------------------------------------------
export type IGProfile = {
  id: string;
  username: string;
  full_name: string;
  biography: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_verified: boolean;
  profile_pic_url: string;
};

export type IGMediaItem = {
  pk: string;
  code: string;
  media_type: number;
  product_type?: string;
  caption?: { text: string } | null;
  like_count?: number;
  comment_count?: number;
  view_count?: number;
  play_count?: number;
  taken_at?: number; // unix seconds
  image_versions2?: { candidates: { url: string; width: number }[] };
  video_versions?: { url: string; width: number }[];
  user?: { username: string; pk: string };
  carousel_media?: unknown[];
};

// ---------------------------------------------------------------------------
// Profile lookup
// ---------------------------------------------------------------------------
export async function fetchProfile(
  username: string,
  account: IGAccount = "scraping"
): Promise<IGProfile> {
  // web_profile_info returns a different shape than the v1 user/show endpoint.
  // Both work, but web_profile_info is more reliable from this IG-App-ID.
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
    username
  )}`;
  const r = await igFetch<{
    data?: {
      user?: {
        id: string;
        username: string;
        full_name?: string;
        biography?: string;
        edge_followed_by?: { count: number };
        edge_follow?: { count: number };
        edge_owner_to_timeline_media?: { count: number };
        is_verified?: boolean;
        profile_pic_url_hd?: string;
        profile_pic_url?: string;
      };
    };
  }>(url, account);
  const u = r.data?.user;
  if (!u) throw new Error(`Profile @${username} not found`);
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name || "",
    biography: u.biography || "",
    follower_count: u.edge_followed_by?.count || 0,
    following_count: u.edge_follow?.count || 0,
    media_count: u.edge_owner_to_timeline_media?.count || 0,
    is_verified: u.is_verified || false,
    profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || "",
  };
}

// ---------------------------------------------------------------------------
// Fetch single media by pk (used to get fresh URLs for transcription/vision)
// ---------------------------------------------------------------------------
export async function fetchMediaByPk(
  mediaPk: string,
  account: IGAccount = "scraping"
): Promise<IGMediaItem> {
  const data = await igFetch<{ items?: IGMediaItem[] }>(
    `${IG_BASE}/media/${mediaPk}/info/`,
    account
  );
  const item = data.items?.[0];
  if (!item) throw new Error(`Media ${mediaPk} not found`);
  return item;
}

export function bestVideoUrl(item: IGMediaItem): string | null {
  const versions = item.video_versions || [];
  if (versions.length === 0) return null;
  return versions.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a))
    .url;
}

export function bestImageUrl(item: IGMediaItem): string | null {
  const candidates = item.image_versions2?.candidates || [];
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a))
    .url;
}

/**
 * Download an IG CDN URL to a temp file. Returns the local path.
 * IG CDN URLs are signed and expire — call this immediately after fetchMediaByPk.
 */
export async function downloadFromIG(url: string, suffix: string): Promise<string> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");
  const r = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.instagram.com/",
    },
  });
  if (!r.ok) throw new Error(`Download failed: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const dest = path.join(os.tmpdir(), `igmedia-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${suffix}`);
  await fs.writeFile(dest, buf);
  return dest;
}

// ---------------------------------------------------------------------------
// User feed (recent posts)
// ---------------------------------------------------------------------------
type IGFeedResponse = {
  items?: IGMediaItem[];
  more_available?: boolean;
  next_max_id?: string;
};

/**
 * Fetches up to `maxPosts` recent posts for the user. Paginates ~50 at a time.
 * Each page is delayed by `delayMs` to be polite to the IG CDN.
 */
export async function fetchUserPosts(
  igUserId: string,
  options: { maxPosts?: number; delayMs?: number; account?: IGAccount } = {}
): Promise<IGMediaItem[]> {
  const maxPosts = options.maxPosts ?? 100;
  const delayMs = options.delayMs ?? 800;
  const account = options.account ?? "scraping";
  const out: IGMediaItem[] = [];
  let nextMaxId: string | undefined;
  while (out.length < maxPosts) {
    const params = new URLSearchParams({ count: "50" });
    if (nextMaxId) params.set("max_id", nextMaxId);
    const data = await igFetch<IGFeedResponse>(
      `${IG_BASE}/feed/user/${igUserId}/?${params.toString()}`,
      account
    );
    const items = data.items || [];
    out.push(...items);
    if (!data.more_available || !data.next_max_id) break;
    nextMaxId = data.next_max_id;
    if (out.length < maxPosts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return out.slice(0, maxPosts);
}

// ---------------------------------------------------------------------------
// Keyword search (reels + posts from any account)
// ---------------------------------------------------------------------------

type IGSearchSerpResponse = {
  status?: string;
  media_grid?: {
    sections?: {
      layout_content?: {
        medias?: { media?: IGMediaItem }[];
      };
    }[];
  };
};

/**
 * Search Instagram by keyword — returns public reels/posts from any creator,
 * not just accounts you've added. Uses the logged-in session cookies.
 */
export async function searchInstagramMedia(
  query: string,
  options: { maxResults?: number; account?: IGAccount } = {}
): Promise<IGMediaItem[]> {
  const maxResults = Math.max(1, Math.min(options.maxResults ?? 25, 50));
  const account = options.account ?? "scraping";
  const url = `https://www.instagram.com/api/v1/fbsearch/web/top_serp/?query=${encodeURIComponent(
    query.trim()
  )}`;
  const data = await igFetch<IGSearchSerpResponse>(url, account);
  const out: IGMediaItem[] = [];
  const seen = new Set<string>();
  for (const section of data.media_grid?.sections || []) {
    for (const row of section.layout_content?.medias || []) {
      const media = row.media;
      if (!media?.pk) continue;
      const pk = String(media.pk);
      if (seen.has(pk)) continue;
      seen.add(pk);
      out.push(media);
      if (out.length >= maxResults) return out;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Normalization helpers (same logic as sync.py)
// ---------------------------------------------------------------------------
export type NormalizedPost = {
  media_pk: string;
  code: string;
  type: "Post" | "Reel" | "Carousel" | "IGTV";
  url: string;
  caption: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  play_count: number;
  taken_at: string | null;
  thumbnail_url: string | null;
};

export function normalizePost(item: IGMediaItem): NormalizedPost | null {
  const pk = item.pk;
  if (!pk) return null;
  const code = item.code || "";
  const productType = item.product_type || "";
  let kind: NormalizedPost["type"];
  if (productType === "clips") kind = "Reel";
  else if (productType === "igtv") kind = "IGTV";
  else if (item.media_type === 8) kind = "Carousel";
  else kind = "Post";

  const url =
    kind === "Reel"
      ? `https://instagram.com/reel/${code}/`
      : `https://instagram.com/p/${code}/`;

  const caption = item.caption?.text || "";

  // Thumbnail: pick the largest image candidate
  let thumbnail: string | null = null;
  const candidates = item.image_versions2?.candidates || [];
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => (b.width > a.width ? b : a));
    thumbnail = best.url;
  }

  return {
    media_pk: String(pk),
    code,
    type: kind,
    url,
    caption,
    like_count: item.like_count || 0,
    comment_count: item.comment_count || 0,
    view_count: item.view_count || 0,
    play_count: item.play_count || 0,
    taken_at: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null,
    thumbnail_url: thumbnail,
  };
}

// ---------------------------------------------------------------------------
// Stat helpers
// ---------------------------------------------------------------------------
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export type ProfileStats = {
  typical_reel_views: number;
  typical_post_likes: number;
};

/**
 * Compute the "typical" metrics across recent posts (Eden-style).
 * - typical_reel_views: median view_count across reels
 * - typical_post_likes: median like_count across non-reel posts
 */
export function computeProfileStats(posts: NormalizedPost[]): ProfileStats {
  const reelViews = posts
    .filter((p) => p.type === "Reel" && p.view_count > 0)
    .map((p) => p.view_count);
  const postLikes = posts
    .filter((p) => p.type !== "Reel" && p.like_count > 0)
    .map((p) => p.like_count);
  return {
    typical_reel_views: median(reelViews),
    typical_post_likes: median(postLikes),
  };
}

export function computeEngagementRate(p: NormalizedPost): number {
  if (p.type === "Reel" && p.view_count > 0) {
    return Math.round(((p.like_count + p.comment_count) / p.view_count) * 10000) / 100;
  }
  if (p.like_count > 0) {
    return Math.round(((p.like_count + p.comment_count) / Math.max(p.like_count * 10, 1)) * 10000) / 100;
  }
  return 0;
}

export function computeOutlier(
  p: NormalizedPost,
  stats: ProfileStats
): number {
  if (p.type === "Reel" && stats.typical_reel_views > 0) {
    return Math.round((p.view_count / stats.typical_reel_views) * 100) / 100;
  }
  if (p.type !== "Reel" && stats.typical_post_likes > 0) {
    return Math.round((p.like_count / stats.typical_post_likes) * 100) / 100;
  }
  return 0;
}
