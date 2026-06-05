/**
 * POST /api/ai/command — streaming AI endpoint for the document editor.
 *
 * Uses the Vercel AI SDK with OUR Google Gemini key (GEMINI_API_KEY). Accepts a
 * UIMessage[] payload (compatible with @ai-sdk/react `useChat` and Plate's AI
 * plugin) plus an optional system prompt, and streams a UI message response.
 *
 * No third-party AI cloud — the model runs on our own key. Model overridable via
 * AI_EDITOR_MODEL (defaults to gemini-2.5-flash).
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_SYSTEM =
  "You are a writing assistant embedded in a rich-text document editor. " +
  "Respond with clean Markdown only — no preamble, no explanations, no code fences " +
  "around the whole answer. Match the surrounding tone. Be concise.";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("GEMINI_API_KEY not configured", { status: 500 });
  }

  const { messages, system } = (await req.json()) as {
    messages: UIMessage[];
    system?: string;
  };

  const google = createGoogleGenerativeAI({ apiKey });
  const result = streamText({
    model: google(process.env.AI_EDITOR_MODEL || "gemini-2.5-flash"),
    system: system || DEFAULT_SYSTEM,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
