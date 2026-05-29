/**
 * Instagram Graph API fetcher — the OFFICIAL, ToS-compliant alternative to the
 * cookie scraper in lib/instagram.ts.
 *
 * Uses the Business Discovery endpoint:
 *   GET /{your-ig-user-id}?fields=business_discovery.username(TARGET){...}
 *
 * This returns BOTH the target's profile fields and a paginated `media` edge in
 * a single node, so we expose one combined function and map its output back into
 * the SAME IGProfile / IGMediaItem shapes the cookie path produces. Everything
 * downstream (normalizePost, computeProfileStats, computeEngagementRate, …) is
 * therefore unchanged.
 *
 * HARD LIMITATIONS of Business Discovery (vs the cookie scraper):
 *   - Target MUST be a Business or Creator account. Personal/private accounts
 *     return an error (we throw IGGraphUnsupported so callers can fall back).
 *   - No `following_count` and no `is_verified` for the target → reported as
 *     0 / false.
 *   - No reliable reel `view_count` / `play_count` for OTHER accounts → 0.
 *     (Insights with view counts are owner-only.) This means reel-based
 *     engagement_rate / outlier_multiplier degrade for graph-sourced data —
 *     like_count + comment_count are still accurate.
 *   - 200 requests/hour base rate limit on the calling user.
 *
 * Config (env):
 *   IG_GRAPH_ACCESS_TOKEN  — long-lived token for your Business/Creator account
 *   IG_GRAPH_USER_ID       — your IG *user id* (the node business_discovery runs on)
 *   IG_GRAPH_API_VERSION   — optional, defaults to v21.0
 *
 * Server-only.
 */
import type { IGProfile, IGMediaItem } from "./instagram";

/** Thrown when a target cannot be served via Graph (not a business/creator, or
 *  not found via discovery). Callers may fall back to the cookie scraper. */
export class IGGraphUnsupported extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IGGraphUnsupported";
  }
}

const GRAPH_BASE = "https://graph.facebook.com";

function apiVersion(): string {
  return process.env.IG_GRAPH_API_VERSION?.trim() || "v21.0";
}

/** True when both the access token and IG user id are present. */
export function isGraphApiConfigured(): boolean {
  return (
    !!process.env.IG_GRAPH_ACCESS_TOKEN?.trim() &&
    !!process.env.IG_GRAPH_USER_ID?.trim()
  );
}

// ---------------------------------------------------------------------------
// Graph response shapes (only the fields we request)
// ---------------------------------------------------------------------------
type GraphMedia = {
  id: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | IGTV | AD
  timestamp?: string; // ISO 8601
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
};

type GraphBusinessDiscovery = {
  id?: string;
  username?: string;
  name?: string;
  biography?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  media?: {
    data?: GraphMedia[];
    paging?: { cursors?: { after?: string }; next?: string };
  };
};

type GraphResponse = {
  business_discovery?: GraphBusinessDiscovery;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

// ---------------------------------------------------------------------------
// Field → IGMediaItem mapping
// ---------------------------------------------------------------------------
function mediaTypeNum(t?: string): number {
  if (t === "VIDEO") return 2;
  if (t === "CAROUSEL_ALBUM") return 8;
  return 1; // IMAGE / default
}

function productType(t?: string): string | undefined {
  if (t === "REELS") return "clips"; // normalizePost expects "clips" → Reel
  if (t === "IGTV") return "igtv";
  return undefined;
}

function codeFromPermalink(permalink?: string): string {
  if (!permalink) return "";
  const m = permalink.match(/\/(?:p|reel|tv)\/([^/]+)/);
  return m ? m[1] : "";
}

function mapMedia(m: GraphMedia, targetUsername: string, igUserId: string): IGMediaItem {
  // Reuse media_url for video items as the "video version" so any downstream
  // CDN logic still has a URL; thumbnail_url (or media_url for images) feeds the
  // image candidate list normalizePost reads for the thumbnail.
  const isVideo = m.media_type === "VIDEO";
  const imageUrl = m.thumbnail_url || (!isVideo ? m.media_url : undefined);
  return {
    pk: String(m.id),
    code: codeFromPermalink(m.permalink),
    media_type: mediaTypeNum(m.media_type),
    product_type: productType(m.media_product_type),
    caption: m.caption ? { text: m.caption } : null,
    like_count: m.like_count ?? 0,
    comment_count: m.comments_count ?? 0,
    view_count: 0, // not available for other accounts via Business Discovery
    play_count: 0,
    taken_at: m.timestamp
      ? Math.floor(new Date(m.timestamp).getTime() / 1000)
      : undefined,
    image_versions2: imageUrl
      ? { candidates: [{ url: imageUrl, width: 1080 }] }
      : undefined,
    video_versions: isVideo && m.media_url ? [{ url: m.media_url, width: 1080 }] : undefined,
    user: { username: targetUsername, pk: igUserId },
  };
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------
function buildUrl(target: string, mediaLimit: number, after?: string): string {
  const igUserId = process.env.IG_GRAPH_USER_ID!.trim();
  const token = process.env.IG_GRAPH_ACCESS_TOKEN!.trim();
  const mediaArgs = after
    ? `media.after(${after}).limit(${mediaLimit})`
    : `media.limit(${mediaLimit})`;
  const fields =
    `business_discovery.username(${target}){` +
    `id,username,name,biography,followers_count,media_count,profile_picture_url,` +
    `${mediaArgs}{id,caption,like_count,comments_count,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url}` +
    `}`;
  const params = new URLSearchParams({ fields, access_token: token });
  return `${GRAPH_BASE}/${apiVersion()}/${igUserId}?${params.toString()}`;
}

async function graphGet(url: string): Promise<GraphResponse> {
  const r = await fetch(url, { cache: "no-store" });
  const json = (await r.json().catch(() => ({}))) as GraphResponse;
  if (!r.ok || json.error) {
    const err = json.error;
    const msg = err?.message || `Graph HTTP ${r.status}`;
    // Common signals that the target simply can't be served via Business
    // Discovery (not a business/creator, or not found). Code 110 / subcode
    // 2207013 and "does not exist" messages fall here.
    const lower = msg.toLowerCase();
    if (
      err?.code === 110 ||
      lower.includes("does not exist") ||
      lower.includes("cannot be loaded") ||
      lower.includes("not a business") ||
      lower.includes("media posted") // some accounts with 0 media error here
    ) {
      throw new IGGraphUnsupported(msg);
    }
    throw new Error(`IG Graph error: ${msg}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Public: combined profile + posts fetch
// ---------------------------------------------------------------------------
/**
 * Fetch a target's profile and up to `maxPosts` recent media via the official
 * Business Discovery endpoint. Returns the same shapes as the cookie path.
 *
 * Throws IGGraphUnsupported when the target isn't reachable via Business
 * Discovery (personal/private account, or not found) so callers can fall back.
 */
export async function fetchProfileAndPostsGraph(
  username: string,
  maxPosts = 90
): Promise<{ profile: IGProfile; items: IGMediaItem[] }> {
  if (!isGraphApiConfigured()) {
    throw new Error(
      "IG Graph API not configured. Set IG_GRAPH_ACCESS_TOKEN and IG_GRAPH_USER_ID."
    );
  }
  const target = username.replace(/^@/, "").trim().toLowerCase();
  const pageSize = Math.min(50, Math.max(1, maxPosts));

  const first = await graphGet(buildUrl(target, pageSize));
  const bd = first.business_discovery;
  if (!bd || !bd.id) {
    throw new IGGraphUnsupported(`@${target} not reachable via Business Discovery`);
  }

  const profile: IGProfile = {
    id: String(bd.id),
    username: bd.username || target,
    full_name: bd.name || "",
    biography: bd.biography || "",
    follower_count: bd.followers_count || 0,
    following_count: 0, // not exposed by Business Discovery
    media_count: bd.media_count || 0,
    is_verified: false, // not exposed by Business Discovery
    profile_pic_url: bd.profile_picture_url || "",
  };

  const items: IGMediaItem[] = [];
  let page: GraphBusinessDiscovery | undefined = bd;
  while (page && items.length < maxPosts) {
    for (const m of page.media?.data || []) {
      items.push(mapMedia(m, profile.username, profile.id));
      if (items.length >= maxPosts) break;
    }
    const after = page.media?.paging?.cursors?.after;
    if (items.length >= maxPosts || !after || !page.media?.paging?.next) break;
    const next = await graphGet(buildUrl(target, pageSize, after));
    page = next.business_discovery;
  }

  return { profile, items: items.slice(0, maxPosts) };
}
