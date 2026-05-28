/**
 * X (Twitter) API v2 client — app-only Bearer token.
 *
 * Env: X_BEARER_TOKEN (from https://developer.x.com → your app → Keys)
 *
 * Pricing is pay-per-use (~$0.005 per post read for third-party data).
 * Server-only.
 */
const API_BASE = "https://api.x.com/2";

export function xConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN?.trim());
}

function bearer(): string {
  const t = process.env.X_BEARER_TOKEN?.trim();
  if (!t) {
    throw new Error(
      "X_BEARER_TOKEN not set. Create an app at https://developer.x.com and add the Bearer token to .env.local"
    );
  }
  return t;
}

export type XPublicMetrics = {
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
};

export type XUser = {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
};

export type XMedia = {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
};

export type XTweet = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: XPublicMetrics;
  attachments?: { media_keys?: string[] };
};

export type XTweetsResponse = {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
    media?: XMedia[];
  };
  meta?: { result_count?: number; next_token?: string };
};

export type XUserResponse = {
  data?: XUser;
  errors?: { detail?: string }[];
};

export async function xApi<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer()}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    errors?: { message?: string; detail?: string }[];
    detail?: string;
  };
  if (!res.ok) {
    const msg =
      body.errors?.[0]?.detail ||
      body.errors?.[0]?.message ||
      (body as { detail?: string }).detail ||
      res.statusText;
    throw new Error(`X API ${path} ${res.status}: ${msg}`);
  }
  return body;
}

const USER_FIELDS =
  "profile_image_url,public_metrics,description,verified,created_at";
const TWEET_FIELDS = "created_at,public_metrics,text,attachments,author_id";
const MEDIA_FIELDS = "url,preview_image_url,type";
const EXPANSIONS = "attachments.media_keys,author_id";

export function parseXHandle(input: string): string {
  const raw = input.trim().replace(/^@/, "");
  const urlMatch = raw.match(
    /(?:twitter\.com|x\.com)\/(@?[\w]+)/i
  );
  if (urlMatch) return urlMatch[1].replace(/^@/, "").toLowerCase();
  return raw.toLowerCase();
}

export async function getUserByUsername(username: string): Promise<XUser> {
  const handle = parseXHandle(username);
  const r = await xApi<XUserResponse>(`/users/by/username/${handle}`, {
    "user.fields": USER_FIELDS,
  });
  if (!r.data?.id) {
    throw new Error(`X user not found: @${handle}`);
  }
  return r.data;
}

export async function getUserTweets(
  userId: string,
  opts: { maxResults?: number; paginationToken?: string } = {}
): Promise<XTweetsResponse> {
  const max = Math.max(5, Math.min(opts.maxResults ?? 50, 100));
  const params: Record<string, string> = {
    max_results: String(max),
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "media.fields": MEDIA_FIELDS,
    "user.fields": USER_FIELDS,
  };
  if (opts.paginationToken) params.pagination_token = opts.paginationToken;
  return xApi<XTweetsResponse>(`/users/${userId}/tweets`, params);
}

export async function searchRecentTweets(
  query: string,
  opts: { maxResults?: number } = {}
): Promise<XTweetsResponse> {
  const max = Math.max(10, Math.min(opts.maxResults ?? 25, 100));
  return xApi<XTweetsResponse>("/tweets/search/recent", {
    query,
    max_results: String(max),
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "media.fields": MEDIA_FIELDS,
    "user.fields": USER_FIELDS,
  });
}

export function mediaByKey(
  includes?: XTweetsResponse["includes"]
): Map<string, XMedia> {
  const map = new Map<string, XMedia>();
  for (const m of includes?.media || []) {
    if (m.media_key) map.set(m.media_key, m);
  }
  return map;
}

export function usersById(
  includes?: XTweetsResponse["includes"]
): Map<string, XUser> {
  const map = new Map<string, XUser>();
  for (const u of includes?.users || []) {
    if (u.id) map.set(u.id, u);
  }
  return map;
}

export function tweetThumbnail(
  tweet: XTweet,
  mediaMap: Map<string, XMedia>
): string | null {
  const keys = tweet.attachments?.media_keys || [];
  for (const key of keys) {
    const m = mediaMap.get(key);
    if (!m) continue;
    if (m.type === "photo" && m.url) return m.url;
    if (m.preview_image_url) return m.preview_image_url;
  }
  return null;
}

export function tweetMediaType(
  tweet: XTweet,
  mediaMap: Map<string, XMedia>
): string {
  const keys = tweet.attachments?.media_keys || [];
  if (keys.length === 0) return "text";
  const m = mediaMap.get(keys[0]);
  if (m?.type === "video" || m?.type === "animated_gif") return "video";
  return "image";
}
