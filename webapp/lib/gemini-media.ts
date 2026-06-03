/**
 * Run a Gemini multimodal prompt against an IG media item — used for both
 * transcription (audio → text) and vision analysis (full deconstruction).
 *
 * Flow: re-fetch the media from IG to get a fresh signed URL, download to
 * /tmp, upload to the Gemini Files API, poll until ACTIVE, run generateContent.
 *
 * Server-only.
 */
import fs from "node:fs/promises";
import { GoogleGenAI, createPartFromUri } from "@google/genai";
import {
  bestImageUrl,
  bestVideoUrl,
  downloadFromIG,
  fetchMediaByPk,
  type IGAccount,
  type IGMediaItem,
} from "./instagram";

const apiKey = process.env.GEMINI_API_KEY!;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export type GeminiMediaResult = {
  text: string;
  model: string;
  /** Files uploaded to the Gemini Files API; cleaned up after use. */
  fileUris: string[];
};

type UploadedFile = { uri: string; mimeType: string };

async function uploadOneToGemini(
  path: string,
  mimeType: string
): Promise<UploadedFile> {
  if (!ai) throw new Error("GEMINI_API_KEY not configured");
  let file = await ai.files.upload({ file: path, config: { mimeType } });
  // Wait for ACTIVE
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    if (!file.name) throw new Error("uploaded file missing name");
    file = await ai.files.get({ name: file.name });
  }
  if (file.state === "FAILED") {
    throw new Error(`Gemini Files API: ${file.error?.message || "FAILED"}`);
  }
  if (!file.uri || !file.mimeType) {
    throw new Error("Gemini uploaded file missing uri/mimeType");
  }
  return { uri: file.uri, mimeType: file.mimeType };
}

/**
 * Returns the list of (path, mimeType) pairs to upload for a given media.
 * Carousels return multiple; single posts/reels return one.
 */
async function downloadMediaItem(
  item: IGMediaItem
): Promise<{ path: string; mimeType: string }[]> {
  const out: { path: string; mimeType: string }[] = [];
  if (item.media_type === 8) {
    // Carousel: walk children
    const children = (item.carousel_media || []) as IGMediaItem[];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.media_type === 2) {
        const url = bestVideoUrl(child);
        if (url) {
          const path = await downloadFromIG(url, "mp4");
          out.push({ path, mimeType: "video/mp4" });
        }
      } else {
        const url = bestImageUrl(child);
        if (url) {
          const path = await downloadFromIG(url, "jpg");
          out.push({ path, mimeType: "image/jpeg" });
        }
      }
    }
  } else if (item.media_type === 2) {
    const url = bestVideoUrl(item);
    if (url) {
      const path = await downloadFromIG(url, "mp4");
      out.push({ path, mimeType: "video/mp4" });
    }
  } else {
    const url = bestImageUrl(item);
    if (url) {
      const path = await downloadFromIG(url, "jpg");
      out.push({ path, mimeType: "image/jpeg" });
    }
  }
  return out;
}

/**
 * Run Gemini on an already-known media item (e.g. a stored creator_posts
 * raw_json, which carries video_versions / image_versions2). This avoids the
 * Instagram cookie API call (fetchMediaByPk); only the CDN download remains,
 * and those signed URLs can expire, so callers may fall back to the pk path.
 */
export async function runGeminiOnMediaItem(
  item: IGMediaItem,
  prompt: string,
  options: { model?: string } = {}
): Promise<GeminiMediaResult> {
  if (!ai) throw new Error("GEMINI_API_KEY not configured");
  const model = options.model || "gemini-2.5-flash";

  const localFiles = await downloadMediaItem(item);
  if (localFiles.length === 0) {
    throw new Error("No downloadable media in item");
  }

  const uploaded: UploadedFile[] = [];
  try {
    for (const f of localFiles) {
      uploaded.push(await uploadOneToGemini(f.path, f.mimeType));
    }

    const parts = [
      ...uploaded.map((u) => createPartFromUri(u.uri, u.mimeType)),
      { text: prompt },
    ];

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
    });
    const text = response.text || "";
    if (!text) throw new Error("Gemini returned empty response");

    return { text, model, fileUris: uploaded.map((u) => u.uri) };
  } finally {
    // Cleanup local temp files (Gemini hosted files auto-expire in 48h)
    for (const f of localFiles) {
      try {
        await fs.unlink(f.path);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Fetch a post's media fresh from Instagram (cookie API) by its pk, then run
 * Gemini on it. Use runGeminiOnMediaItem instead when you already have the
 * media item (e.g. stored raw_json) to avoid the cookie call.
 */
export async function runGeminiOnMedia(
  mediaPk: string,
  prompt: string,
  options: { model?: string; account?: IGAccount } = {}
): Promise<GeminiMediaResult> {
  const account = options.account ?? "scraping";
  const item = await fetchMediaByPk(mediaPk, account);
  return runGeminiOnMediaItem(item, prompt, { model: options.model });
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
export const TRANSCRIBE_PROMPT = `Transcribe the spoken audio in this video. Preserve speaker style and rhythm. Output ONLY the transcript text — no preamble, no timestamps, no speaker labels unless multiple speakers are present. If there is no spoken audio, output the literal string "(no spoken audio)".`;

export const POST_VISION_PROMPT = `You are analyzing this Instagram post for a content creator whose audience is **AI Creatives, AI Filmmakers, AI Ads creators, and AI Video & Image producers**.

Reverse-engineer what makes this content work. Be specific and tactical — every section should give the creator something they can lift directly. Avoid vague principles.

Output as plain markdown with these EXACT section headers (use \`##\`):

## Hook (first 0-3 seconds)
## Visual Structure
## On-Screen Text
## Audio / Voiceover
## Replicable Technique
## Tools / Workflow Signals
## Content Type & Sub-Genre
## One-Line Takeaway`;
