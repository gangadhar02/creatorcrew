/**
 * Auto-tag bookmarks with Gemini Flash.
 *
 * Server-only.
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { BookmarkItem } from "./types-bookmarks";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.BOOKMARK_TAG_MODEL || "gemini-2.5-flash";

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const TAG_SCHEMA = {
  type: Type.OBJECT,
  required: ["items"],
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["id", "tags"],
        properties: {
          id: { type: Type.STRING },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "3–6 short topical tags, lowercase, hyphenated (e.g. ai-agents, startup-marketing).",
          },
        },
      },
    },
  },
};

export async function tagBookmarksWithGemini(
  items: Pick<BookmarkItem, "id" | "platform" | "caption" | "author_handle">[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ai || items.length === 0) return out;

  const batchSize = 20;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const lines = batch
      .map(
        (b) =>
          `- id=${b.id} platform=${b.platform} @${b.author_handle || "?"}: ${(b.caption || "").slice(0, 400)}`
      )
      .join("\n");

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You label saved social posts for a creative research board.
For each item, return 3–6 concise tags (topics, format, niche). No hashtags in tag strings.

Items:
${lines}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: TAG_SCHEMA,
        temperature: 0.3,
      },
    });

    const text = response.text?.trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as {
        items?: { id: string; tags: string[] }[];
      };
      for (const row of parsed.items || []) {
        if (row.id && Array.isArray(row.tags)) {
          out.set(
            row.id,
            row.tags
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
              .slice(0, 8)
          );
        }
      }
    } catch {
      console.warn("[bookmark-tagging] failed to parse Gemini JSON batch");
    }
  }

  return out;
}
