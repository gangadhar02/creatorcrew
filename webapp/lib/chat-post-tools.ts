/**
 * On-demand chat tools for creator_post-context chats.
 *
 * When the user asks about a post's script/transcript or visual breakdown and
 * the data isn't already on the post, we run a quick Gemini tool-routing pass.
 * If the model calls a tool, we execute it server-side (transcribe the reel /
 * run vision analysis), persist the result to the post, and return a context
 * block to inject into the main generation so the model can answer with it.
 *
 * Server-only.
 */
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { getSupabase } from "./supabase";
import { runGeminiOnMedia, TRANSCRIBE_PROMPT } from "./gemini-media";
import { mirrorTranscriptToCreatorPost } from "./dual-write";
import { enrichPost } from "./enrich";

export type ChatContent = { role: "user" | "model"; parts: { text: string }[] };

export type PostToolsResult = { note: string; ran: string[] };

/**
 * @param allow which tools to offer (skip ones whose data the post already has)
 */
export async function runChatPostTools(opts: {
  ai: GoogleGenAI;
  postId: string;
  contents: ChatContent[];
  systemPrompt: string;
  allow: { transcript: boolean; vision: boolean };
  /** Fired once we know which tools will run (before the slow work). */
  onToolStart?: (names: string[]) => void;
}): Promise<PostToolsResult> {
  const { ai, postId, contents, systemPrompt, allow, onToolStart } = opts;

  const decls: object[] = [];
  if (allow.transcript) {
    decls.push({
      name: "fetch_transcript",
      description:
        "Fetch the spoken-audio transcript (the script / voiceover) of THIS post's video by transcribing it. Call this when the user asks about the script, voiceover, what was said, or wants the transcript.",
      parameters: { type: "object", properties: {} },
    });
  }
  if (allow.vision) {
    decls.push({
      name: "run_vision_analysis",
      description:
        "Run a visual deconstruction of THIS post (hook, on-screen text, structure, format, devices). Call this when the user asks how it was made, for the visual breakdown, or to analyze the frames.",
      parameters: { type: "object", properties: {} },
    });
  }
  if (decls.length === 0) return { note: "", ran: [] };

  // Cheap routing pass — does the latest message call for media data?
  let calls: { name?: string }[] = [];
  try {
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: {
          parts: [
            {
              text:
                systemPrompt +
                "\n\nIf the user is asking about this post's script/transcript or its visual breakdown and that data isn't already provided above, call the matching tool. Otherwise answer normally without calling a tool.",
            },
          ],
        },
        tools: [{ functionDeclarations: decls }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
        },
        temperature: 0,
      },
    });
    calls = resp.functionCalls || [];
  } catch {
    return { note: "", ran: [] };
  }
  if (calls.length === 0) return { note: "", ran: [] };

  const willRun = Array.from(
    new Set(calls.map((c) => c.name || "").filter(Boolean))
  );
  onToolStart?.(willRun);

  const sb = getSupabase();
  const { data: post } = await sb
    .from("creator_posts")
    .select("platform_pk")
    .eq("id", postId)
    .maybeSingle();
  const mediaPk = (post as { platform_pk?: string } | null)?.platform_pk;

  const blocks: string[] = [];
  const ran: string[] = [];
  const seen = new Set<string>();

  for (const c of calls) {
    const name = c.name || "";
    if (seen.has(name)) continue;
    seen.add(name);

    if (name === "fetch_transcript" && allow.transcript && mediaPk) {
      try {
        const { text } = await runGeminiOnMedia(mediaPk, TRANSCRIBE_PROMPT, {
          model: "gemini-2.5-flash",
        });
        await sb.from("creator_posts").update({ transcript: text }).eq("id", postId);
        await mirrorTranscriptToCreatorPost(mediaPk, text);
        blocks.push(`## Transcript (fetched just now)\n${text}`);
        ran.push("transcript");
      } catch (e) {
        blocks.push(
          `## Transcript\n(Couldn't fetch the transcript: ${String(e).slice(0, 160)})`
        );
      }
    }

    if (name === "run_vision_analysis" && allow.vision) {
      try {
        await enrichPost(postId, { force: false });
        const { data: enriched } = await sb
          .from("creator_posts")
          .select("ai_description, ai_overview, vision_analysis_md")
          .eq("id", postId)
          .maybeSingle();
        const e = (enriched || {}) as {
          ai_description?: string | null;
          ai_overview?: unknown;
          vision_analysis_md?: string | null;
        };
        const parts: string[] = [];
        if (e.ai_description) parts.push(e.ai_description);
        if (e.vision_analysis_md) parts.push(e.vision_analysis_md);
        else if (e.ai_overview) parts.push(JSON.stringify(e.ai_overview));
        blocks.push(
          `## Visual analysis (fetched just now)\n${parts.join("\n\n") || "(no analysis produced)"}`
        );
        ran.push("vision");
      } catch (e) {
        blocks.push(
          `## Visual analysis\n(Couldn't run analysis: ${String(e).slice(0, 160)})`
        );
      }
    }
  }

  return { note: blocks.join("\n\n"), ran };
}
