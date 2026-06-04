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
import { analyzeSinglePostForChat } from "./creator-data";

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
  const names = new Set(calls.map((c) => c.name || ""));
  const wantTranscript = allow.transcript && names.has("fetch_transcript");
  const wantVision = allow.vision && names.has("run_vision_analysis");
  if (!wantTranscript && !wantVision) return { note: "", ran: [] };

  onToolStart?.(willRun);

  // Run REAL media analysis on THIS post (cookie-free Apify fetch + Gemini
  // multimodal), the same pipeline the creator analyzer uses per post. This
  // analyzes the post's actual frames/audio, not a text-only pass.
  const result = await analyzeSinglePostForChat(postId, {
    transcript: wantTranscript,
    vision: wantVision,
  });

  const blocks: string[] = [];
  if (wantTranscript) {
    if (result.transcript) {
      blocks.push(`## Transcript (fetched just now)\n${result.transcript}`);
    } else {
      blocks.push(
        `## Transcript\n(Couldn't fetch the transcript${
          result.errors.length ? `: ${result.errors.join("; ")}` : ""
        })`
      );
    }
  }
  if (wantVision) {
    if (result.vision) {
      blocks.push(`## Visual analysis (fetched just now)\n${result.vision}`);
    } else {
      blocks.push(
        `## Visual analysis\n(Couldn't run analysis${
          result.errors.length ? `: ${result.errors.join("; ")}` : ""
        })`
      );
    }
  }

  return { note: blocks.join("\n\n"), ran: result.ran };
}
