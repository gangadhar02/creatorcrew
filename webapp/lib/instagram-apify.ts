/**
 * Instagram fetcher backed by the Apify "Instagram Scraper" actor
 * (apify/instagram-scraper). Third-party scraping service — Apify handles
 * proxies/rotation, so it doesn't burn OUR cookies and isn't IP-banned like the
 * direct cookie scraper. Works on any public account (personal/business/creator)
 * and returns reel view/play counts, unlike the Graph API.
 *
 * Maps Apify output back into the SAME IGProfile / IGMediaItem shapes the cookie
 * path produces, so normalizePost / the stat helpers are unchanged.
 *
 * Config (env):
 *   APIFY_API_TOKEN   — Apify API token (required)
 *   APIFY_IG_ACTOR    — optional actor id, defaults to apify~instagram-scraper
 *
 * Cost: ~$1.50 / 1,000 results (≈ $0.14 to analyze a 90-post profile).
 * Server-only.
 */
import type { IGProfile, IGMediaItem } from "./instagram";

const DEFAULT_ACTOR = "apify~instagram-scraper";

export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN?.trim();
}

// ---------------------------------------------------------------------------
// Apify actor output shapes (only the fields we use)
// ---------------------------------------------------------------------------
type ApifyPost = {
  id?: string;
  shortCode?: string;
  type?: string; // Image | Video | Sidecar
  productType?: string; // clips | igtv | feed
  isVideo?: boolean;
  caption?: string;
  url?: string;
  commentsCount?: number;
  likesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string; // ISO 8601
  displayUrl?: string;
  videoUrl?: string;
  ownerUsername?: string;
  ownerId?: string;
  // Parent profile fields — present on every item when addParentData=true.
  username?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  verified?: boolean;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------
function mapPost(p: ApifyPost, ownerUsername: string, ownerId: string): IGMediaItem {
  const pt = (p.productType || "").toLowerCase();
  const product_type = pt === "clips" ? "clips" : pt === "igtv" ? "igtv" : undefined;

  let media_type = 1; // Image
  if (p.type === "Sidecar") media_type = 8; // Carousel
  else if (p.type === "Video" || p.isVideo) media_type = 2;

  // IG reports reels as "plays"; older content as "views". Prefer whichever is set.
  const views = p.videoPlayCount ?? p.videoViewCount ?? 0;

  return {
    pk: String(p.id || p.shortCode || ""),
    code: p.shortCode || "",
    media_type,
    product_type,
    caption: p.caption ? { text: p.caption } : null,
    like_count: p.likesCount ?? 0,
    comment_count: p.commentsCount ?? 0,
    view_count: views,
    play_count: p.videoPlayCount ?? 0,
    taken_at: p.timestamp
      ? Math.floor(new Date(p.timestamp).getTime() / 1000)
      : undefined,
    image_versions2: p.displayUrl
      ? { candidates: [{ url: p.displayUrl, width: 1080 }] }
      : undefined,
    video_versions: p.videoUrl ? [{ url: p.videoUrl, width: 1080 }] : undefined,
    user: { username: p.ownerUsername || ownerUsername, pk: p.ownerId || ownerId },
  };
}

// ---------------------------------------------------------------------------
// Actor run (synchronous — returns dataset items directly)
// ---------------------------------------------------------------------------
async function runActor(input: unknown): Promise<unknown[]> {
  const token = process.env.APIFY_API_TOKEN!.trim();
  const actor = process.env.APIFY_IG_ACTOR?.trim() || DEFAULT_ACTOR;
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Apify HTTP ${r.status}: ${body.slice(0, 300)}`);
  }
  return (await r.json()) as unknown[];
}

// ---------------------------------------------------------------------------
// Public: combined profile + posts fetch
// ---------------------------------------------------------------------------
export async function fetchProfileAndPostsApify(
  username: string,
  maxPosts = 90
): Promise<{ profile: IGProfile; items: IGMediaItem[] }> {
  if (!isApifyConfigured()) {
    throw new Error("Apify not configured. Set APIFY_API_TOKEN.");
  }
  const handle = username.replace(/^@/, "").trim().toLowerCase();
  // "posts" mode paginates up to resultsLimit (the "details" mode caps
  // latestPosts at ~12). addParentData flattens the profile fields
  // (followersCount, biography, verified, …) onto every post item, so one run
  // yields both the profile and all N posts.
  const input = {
    directUrls: [`https://www.instagram.com/${handle}/`],
    resultsType: "posts",
    resultsLimit: maxPosts,
    addParentData: true,
  };

  const data = (await runActor(input)) as ApifyPost[];

  // Surface an explicit actor error (private account, not found, etc.).
  const errored = data.find((d) => d && d.error && !d.shortCode);
  if (errored?.error) {
    throw new Error(`Apify error for @${handle}: ${errored.error}`);
  }

  // Actual post items carry a shortCode; the parent-data fields ride along.
  const posts = data.filter((d) => d && d.shortCode).slice(0, maxPosts);
  // Profile comes from the parent-data fields on the first item that has them.
  const head = data.find((d) => d && d.followersCount !== undefined) || posts[0];
  if (!head) {
    throw new Error(`Apify returned no data for @${handle}`);
  }

  const profile: IGProfile = {
    id: String(head.ownerId || ""),
    username: head.ownerUsername || head.username || handle,
    full_name: head.fullName || "",
    biography: head.biography || "",
    follower_count: head.followersCount || 0,
    following_count: head.followsCount || 0,
    media_count: head.postsCount || 0,
    is_verified: !!head.verified,
    profile_pic_url: head.profilePicUrlHD || head.profilePicUrl || "",
  };

  const items = posts.map((p) => mapPost(p, profile.username, profile.id));

  return { profile, items };
}

// ---------------------------------------------------------------------------
// Public: single post by permalink
// ---------------------------------------------------------------------------
/**
 * Fetch ONE Instagram post by its permalink (instagram.com/p/<code>/ or
 * /reel/<code>/). Returns the post mapped to IGMediaItem plus the owner's
 * profile fields (via addParentData), or null if the actor returned no post
 * (private/removed). Used to ingest a pasted URL on demand.
 */
export async function fetchPostByUrlApify(
  postUrl: string
): Promise<{ profile: IGProfile; item: IGMediaItem } | null> {
  if (!isApifyConfigured()) {
    throw new Error("Apify not configured. Set APIFY_API_TOKEN.");
  }
  const input = {
    directUrls: [postUrl],
    resultsType: "posts",
    resultsLimit: 1,
    addParentData: true,
  };

  const data = (await runActor(input)) as ApifyPost[];

  const errored = data.find((d) => d && d.error && !d.shortCode);
  if (errored?.error) {
    throw new Error(`Apify error: ${errored.error}`);
  }

  const post = data.find((d) => d && d.shortCode);
  if (!post) return null;

  const ownerUsername = (post.ownerUsername || post.username || "")
    .replace(/^@/, "")
    .toLowerCase();
  const ownerId = String(post.ownerId || "");

  const profile: IGProfile = {
    id: ownerId,
    username: ownerUsername,
    full_name: post.fullName || "",
    biography: post.biography || "",
    follower_count: post.followersCount || 0,
    following_count: post.followsCount || 0,
    media_count: post.postsCount || 0,
    is_verified: !!post.verified,
    profile_pic_url: post.profilePicUrlHD || post.profilePicUrl || "",
  };

  const item = mapPost(post, ownerUsername, ownerId);
  return { profile, item };
}
