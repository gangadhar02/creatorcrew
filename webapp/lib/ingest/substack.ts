/**
 * Substack RSS ingestor.
 *
 * Every Substack publication exposes `/feed` returning an RSS XML doc.
 * No engagement metrics are available — we just record published_at +
 * title + url + description. Sort by recency in Discover.
 *
 * Input handles:
 *   - "publication"             → https://publication.substack.com/feed
 *   - "publication.substack.com" → same
 *   - "https://blog.example.com" → https://blog.example.com/feed
 *
 * Server-only. Uses native fetch + minimal regex-based XML parsing
 * (Substack feeds are well-structured so this is safe).
 */
import {
  getDefaultWorkspaceId,
  upsertCreator,
  upsertCreatorPost,
} from "../dual-write";

function resolveFeedUrl(input: string): { feedUrl: string; siteOrigin: string; handle: string } {
  const raw = input.trim().replace(/^@/, "");
  // Already a URL?
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    const feedUrl = raw.endsWith("/feed") ? raw : `${u.origin}/feed`;
    const handle = u.hostname.replace(/^www\./, "").split(".")[0].toLowerCase();
    return { feedUrl, siteOrigin: u.origin, handle };
  }
  // bare handle → assume .substack.com
  const host = raw.includes(".") ? raw : `${raw}.substack.com`;
  const siteOrigin = `https://${host}`;
  const handle = host.split(".")[0].toLowerCase();
  return { feedUrl: `${siteOrigin}/feed`, siteOrigin, handle };
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pick(item: string, tag: string): string | null {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
  return m ? decodeEntities(stripCdata(m[1])) : null;
}

type ParsedFeed = {
  channelTitle: string;
  channelDescription: string;
  channelLink: string;
  channelImage: string | null;
  items: {
    title: string;
    link: string;
    description: string;
    pubDate: string | null;
    guid: string;
    thumb: string | null;
  }[];
};

function parseFeed(xml: string): ParsedFeed {
  const channelMatch = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
  if (!channelMatch) throw new Error("RSS: no <channel> found");
  const channel = channelMatch[1];

  // Channel-level fields (strip out <item> blocks first so we don't pick those).
  const channelMeta = channel.replace(/<item[\s\S]*?<\/item>/gi, "");
  const channelTitle = pick(channelMeta, "title") || "";
  const channelDescription = pick(channelMeta, "description") || "";
  const channelLink = pick(channelMeta, "link") || "";
  const imgMatch = channelMeta.match(/<image[\s\S]*?<url>([\s\S]*?)<\/url>/i);
  const channelImage = imgMatch ? imgMatch[1].trim() : null;

  const items: ParsedFeed["items"] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(channel))) {
    const it = m[1];
    const title = pick(it, "title") || "";
    const link = pick(it, "link") || "";
    const description = pick(it, "description") || pick(it, "content:encoded") || "";
    const pubDate = pick(it, "pubDate");
    const guid = pick(it, "guid") || link;
    // Hero image: media:thumbnail, media:content, enclosure, or first <img> in body.
    let thumb: string | null = null;
    const mediaThumb = it.match(/<media:thumbnail[^>]*\burl="([^"]+)"/i);
    if (mediaThumb) thumb = mediaThumb[1];
    if (!thumb) {
      const mediaContent = it.match(
        /<media:content[^>]*\burl="([^"]+)"[^>]*\bmedium="image"/i
      );
      if (mediaContent) thumb = mediaContent[1];
    }
    if (!thumb) {
      const enc = it.match(/<enclosure[^>]*\burl="([^"]+)"/i);
      if (enc) thumb = enc[1];
    }
    if (!thumb) {
      const og = description.match(/<img[^>]+src="([^"]+)"/i);
      if (og) thumb = og[1];
    }
    if (!thumb) {
      const contentEncoded = pick(it, "content:encoded") || "";
      const img = contentEncoded.match(/<img[^>]+src="([^"]+)"/i);
      if (img) thumb = img[1];
    }
    items.push({ title, link, description, pubDate, guid, thumb });
  }
  return { channelTitle, channelDescription, channelLink, channelImage, items };
}

export type SubstackIngestResult = {
  handle: string;
  display_name: string;
  posts_cached: number;
  feed_url: string;
};

export async function ingestSubstackPublication(
  input: string,
  opts: { maxItems?: number } = {}
): Promise<SubstackIngestResult> {
  const wsId = await getDefaultWorkspaceId();
  if (!wsId) throw new Error("No workspace configured");
  const maxItems = Math.max(1, Math.min(opts.maxItems ?? 50, 200));

  const { feedUrl, handle } = resolveFeedUrl(input);
  const r = await fetch(feedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SavesEngine/1.0; +https://github.com/saves-engine)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Substack feed HTTP ${r.status}: ${feedUrl}`);
  const xml = await r.text();
  const feed = parseFeed(xml);

  const creatorId = await upsertCreator(wsId, "substack", handle, {
    display_name: feed.channelTitle,
    bio: feed.channelDescription.slice(0, 4000) || null,
    avatar_url: feed.channelImage,
    follower_count: null, // not exposed
    post_count: feed.items.length,
    is_verified: false,
    last_synced_at: new Date().toISOString(),
    sync_status: "idle",
  });
  if (!creatorId) throw new Error("Failed to upsert creator");

  const items = feed.items.slice(0, maxItems);
  for (const it of items) {
    const publishedAt = it.pubDate ? new Date(it.pubDate).toISOString() : null;
    // Use the link as platform_pk since Substack GUIDs are usually URLs anyway.
    const pk = it.guid || it.link;
    // Title strips a description that often starts with "<p>". Use title as the main field.
    const plainDesc = it.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    await upsertCreatorPost({
      creator_id: creatorId,
      platform: "substack",
      platform_pk: pk,
      code: null,
      url: it.link,
      media_type: "Article",
      title_or_caption: it.title,
      transcript: plainDesc.slice(0, 8000) || null,
      published_at: publishedAt,
      thumbnail_url: it.thumb,
      raw_json: it as unknown as Record<string, unknown>,
    });
  }

  return {
    handle,
    display_name: feed.channelTitle,
    posts_cached: items.length,
    feed_url: feedUrl,
  };
}
