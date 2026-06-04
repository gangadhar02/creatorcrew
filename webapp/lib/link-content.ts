/**
 * Best-effort readable content for a single URL, used by voice extraction.
 *
 * - Instagram: fresh media via Apify + Gemini transcription (cookie-free), plus
 *   the caption. Same pipeline as creator analysis.
 * - YouTube: caption track (transcript) scraped from the watch page, falling
 *   back to the video description.
 * - X / Twitter: tweet text via the public oEmbed endpoint (no auth).
 * - Everything else (Substack, blogs, LinkedIn, TikTok, ...): fetched HTML
 *   stripped to text.
 *
 * Server-only. Never throws: returns a note string on failure so one bad link
 * doesn't sink the whole extraction.
 */
import { GoogleGenAI } from "@google/genai";
import { isApifyConfigured, fetchPostByUrlApify } from "./instagram-apify";
import { runGeminiOnMediaItem, TRANSCRIBE_PROMPT } from "./gemini-media";
import { normalizePost } from "./instagram";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export type LinkContent = { url: string; label: string; text: string };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function stripHtml(html: string, max: number): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function youtubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?&/]+)/) ||
    url.match(/youtube\.com\/shorts\/([^?&/]+)/);
  return m ? m[1] : null;
}

export async function fetchLinkContent(url: string): Promise<LinkContent> {
  const host = hostOf(url);
  try {
    if (host.includes("instagram.com")) return await fromInstagram(url);
    if (host.includes("youtube.com") || host.includes("youtu.be"))
      return await fromYouTube(url);
    if (host.includes("x.com") || host.includes("twitter.com"))
      return await fromX(url);
    return await fromWeb(url);
  } catch (e) {
    return {
      url,
      label: url,
      text: `(could not read this link: ${String(e).slice(0, 120)})`,
    };
  }
}

async function fromInstagram(url: string): Promise<LinkContent> {
  if (!isApifyConfigured()) return fromWeb(url);
  const fresh = await fetchPostByUrlApify(url);
  const item = fresh?.item;
  if (!item) return fromWeb(url);
  const norm = normalizePost(item);
  const caption = norm?.caption || "";
  let transcript = "";
  try {
    const r = await runGeminiOnMediaItem(item, TRANSCRIBE_PROMPT);
    transcript = r.text || "";
  } catch {
    // video may be image-only or transcription failed; caption still useful
  }
  const text = [
    caption && `Caption: ${caption}`,
    transcript && `Transcript: ${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);
  return {
    url,
    label: `Instagram (@${item.user?.username || "?"})`,
    text: text || "(no readable content)",
  };
}

async function fromYouTube(url: string): Promise<LinkContent> {
  // Gemini ingests YouTube URLs directly as video input, so we get a real
  // spoken transcript without scraping caption tracks (YouTube now returns
  // empty caption bodies to server requests).
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const resp = await ai.models.generateContent({
        model: process.env.CHAT_MODEL_VISION || "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { fileData: { fileUri: url } },
              {
                text: `${TRANSCRIBE_PROMPT}\n\nStart with the video's title on its own line, then the transcript.`,
              },
            ],
          },
        ],
      });
      const text = resp.text?.trim();
      if (text) {
        return { url, label: "YouTube", text: text.slice(0, 6000) };
      }
    } catch {
      // fall through to title + description scrape
    }
  }

  // Fallback: title + description from the watch page.
  const id = youtubeId(url);
  if (!id) return fromWeb(url);
  const page = await fetch(`https://www.youtube.com/watch?v=${id}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
  }).then((r) => r.text());
  const title = stripHtml(page.match(/<title>([^<]+)<\/title>/)?.[1] || "", 200);
  let description = "";
  const descRaw = page.match(/"shortDescription":"((?:\\.|[^"\\])*)"/)?.[1];
  if (descRaw) {
    try {
      description = JSON.parse(`"${descRaw}"`) as string;
    } catch {
      description = descRaw;
    }
  }
  const text = [title && `Title: ${title}`, description && `Description: ${description}`]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);
  return { url, label: "YouTube", text: text || "(no readable content)" };
}

async function fromX(url: string): Promise<LinkContent> {
  const res = await fetch(
    `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(
      url
    )}`,
    { headers: { "User-Agent": UA } }
  );
  if (res.ok) {
    const o = (await res.json()) as { html?: string; author_name?: string };
    if (o?.html) {
      return {
        url,
        label: `X (@${o.author_name || "?"})`,
        text: stripHtml(o.html, 4000) || "(no readable content)",
      };
    }
  }
  return fromWeb(url);
}

async function fromWeb(url: string): Promise<LinkContent> {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) {
    return { url, label: url, text: `(failed to fetch: ${r.status})` };
  }
  const html = await r.text();
  return { url, label: url, text: stripHtml(html, 4000) };
}
