/**
 * Generate and store a vector embedding for a creator_posts row.
 * Used by semantic Discover search (pgvector + Gemini embeddings).
 *
 * Server-only.
 */
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "./supabase";

const apiKey = process.env.GEMINI_API_KEY!;
const EMBED_MODEL = process.env.EMBED_MODEL || "gemini-embedding-001";

export async function embedPost(id: string): Promise<boolean> {
  if (!apiKey) return false;
  const sb = getSupabase();
  const { data } = await sb
    .from("creator_posts")
    .select(
      "id, title_or_caption, ai_description, ai_tags, transcript, platform"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return false;
  const r = data as {
    id: string;
    title_or_caption: string | null;
    ai_description: string | null;
    ai_tags: string[] | null;
    transcript: string | null;
    platform: string | null;
  };
  const text = [
    r.platform ? `[${r.platform}]` : "",
    r.title_or_caption || "",
    r.ai_description || "",
    (r.ai_tags || []).join(" "),
    r.transcript || "",
  ]
    .filter(Boolean)
    .join("\n");
  if (!text.trim()) return false;
  const ai = new GoogleGenAI({ apiKey });
  const resp = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
  });
  const v = resp.embeddings?.[0]?.values;
  if (!v) return false;
  await sb.from("creator_posts").update({ embedding: v }).eq("id", r.id);
  return true;
}

/** Fire-and-forget embedding for a post. */
export function enqueueEmbed(postId: string): void {
  void embedPost(postId).catch((e) =>
    console.warn(`[embed] post ${postId} failed:`, e)
  );
}
