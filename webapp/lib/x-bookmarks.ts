/**
 * Fetch X bookmarks via logged-in session cookies (auth_token + ct0).
 *
 * Uses X's internal GraphQL API — query id may need updating if X changes it.
 * Set X_BOOKMARKS_QUERY_ID in .env.local if sync fails with GraphQL errors.
 *
 * Server-only.
 */
import {
  getXCookies,
  verifyXCookies,
  xApiHeaders,
  xCookiesConfigured,
} from "./x-config";
import type { BookmarkDraft } from "./types-bookmarks";

const DEFAULT_QUERY_ID =
  process.env.X_BOOKMARKS_QUERY_ID || "X27bFqQ6kF3R7-hKx4-28w";

const FEATURES = {
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

type GqlTweet = {
  rest_id?: string;
  legacy?: {
    full_text?: string;
    created_at?: string;
    user_id_str?: string;
  };
};

type GqlUser = {
  rest_id?: string;
  legacy?: {
    screen_name?: string;
    name?: string;
  };
};

type GqlMedia = {
  media_url_https?: string;
  type?: string;
};

function parseTimeline(json: unknown): {
  tweets: { tweet: GqlTweet; user?: GqlUser; mediaUrl?: string }[];
  cursor?: string;
} {
  const tweets: { tweet: GqlTweet; user?: GqlUser; mediaUrl?: string }[] = [];
  let cursor: string | undefined;

  const root = json as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  const bookmark = data?.bookmark_timeline_v2 as Record<string, unknown> | undefined;
  const timeline = bookmark?.timeline as Record<string, unknown> | undefined;
  const instructions = (timeline?.instructions || []) as Record<string, unknown>[];

  for (const inst of instructions) {
    if (inst.type === "TimelineAddEntries") {
      const entries = (inst.entries || []) as Record<string, unknown>[];
      for (const entry of entries) {
        const entryId = String(entry.entryId || "");
        if (entryId.startsWith("cursor-bottom")) {
          const content = entry.content as Record<string, unknown> | undefined;
          const value = content?.value as string | undefined;
          if (value) cursor = value;
          continue;
        }
        const content = entry.content as Record<string, unknown> | undefined;
        const itemContent = content?.itemContent as Record<string, unknown> | undefined;
        const tweetResults = itemContent?.tweet_results as Record<string, unknown> | undefined;
        const result = tweetResults?.result as Record<string, unknown> | undefined;
        if (!result) continue;

        const tweet = (result.tweet || result) as GqlTweet;
        const core = result.core as Record<string, unknown> | undefined;
        const userResults = core?.user_results as Record<string, unknown> | undefined;
        const userResult = userResults?.result as Record<string, unknown> | undefined;
        const user = (userResult?.legacy ? userResult : userResult) as GqlUser | undefined;

        const legacy = tweet.legacy;
        const entities = legacy as { extended_entities?: { media?: GqlMedia[] } } | undefined;
        const media = entities?.extended_entities?.media?.[0];
        const mediaUrl = media?.media_url_https;

        if (tweet.rest_id) {
          tweets.push({ tweet, user, mediaUrl });
        }
      }
    }
  }

  return { tweets, cursor };
}

function tweetToDraft(
  tweet: GqlTweet,
  user: GqlUser | undefined,
  mediaUrl?: string
): BookmarkDraft | null {
  const id = tweet.rest_id;
  const text = tweet.legacy?.full_text;
  if (!id || !text) return null;
  const handle = user?.legacy?.screen_name?.toLowerCase() || "unknown";
  const created = tweet.legacy?.created_at
    ? new Date(tweet.legacy.created_at).toISOString()
    : null;

  return {
    platform: "x",
    external_id: id,
    url: `https://x.com/${handle}/status/${id}`,
    author_handle: handle,
    author_name: user?.legacy?.name || handle,
    caption: text,
    thumbnail_url: mediaUrl || null,
    media_type: mediaUrl ? "image" : "text",
    saved_at: created,
    raw_json: { tweet, user } as Record<string, unknown>,
  };
}

export async function fetchXBookmarks(opts: {
  maxItems?: number;
} = {}): Promise<{ items: BookmarkDraft[]; warning?: string }> {
  if (!xCookiesConfigured()) {
    return {
      items: [],
      warning:
        "X cookies not set. Add X_AUTH_TOKEN and X_CT0 to .env.local (from x.com → auth_token + ct0 cookies).",
    };
  }

  const session = await verifyXCookies();
  if (!session.ok) {
    return { items: [], warning: session.error };
  }

  const cookies = getXCookies();
  const headers = xApiHeaders(cookies);
  const maxItems = Math.max(1, Math.min(opts.maxItems ?? 80, 200));
  const drafts: BookmarkDraft[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (drafts.length < maxItems && pages < 8) {
    const variables = {
      count: 20,
      cursor: cursor || null,
      includePromotedContent: false,
    };

    const url = new URL(
      `https://x.com/i/api/graphql/${DEFAULT_QUERY_ID}/Bookmarks`
    );
    url.searchParams.set("variables", JSON.stringify(variables));
    url.searchParams.set("features", JSON.stringify(FEATURES));

    const res = await fetch(url.toString(), { headers, cache: "no-store" });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const authFailed =
        res.status === 401 || body.includes('"code":32');
      return {
        items: drafts,
        warning: authFailed
          ? "X cookies invalid or expired. Log into x.com, open DevTools → Network, reload Bookmarks, copy the full Cookie header into X_COOKIE in .env.local (or refresh X_AUTH_TOKEN + X_CT0 from the same session), then restart the server."
          : `X bookmarks HTTP ${res.status}: ${body.slice(0, 200)}. If GraphQL changed, set X_BOOKMARKS_QUERY_ID.`,
      };
    }

    const json = await res.json();
    const { tweets, cursor: next } = parseTimeline(json);

    if (tweets.length === 0 && drafts.length === 0) {
      return {
        items: [],
        warning:
          "X returned no bookmarks — cookies may be expired or GraphQL query id changed (set X_BOOKMARKS_QUERY_ID).",
      };
    }

    for (const row of tweets) {
      const d = tweetToDraft(row.tweet, row.user, row.mediaUrl);
      if (d) {
        drafts.push(d);
        if (drafts.length >= maxItems) break;
      }
    }

    if (!next) break;
    cursor = next;
    pages += 1;
  }

  return { items: drafts };
}
