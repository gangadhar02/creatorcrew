/**
 * POST /api/chat
 * Body: {
 *   chat_id?: string,           // append if set, else create
 *   context_kind?, context_id?, // initial context if creating
 *   voice_id?: string | null,
 *   message: string,            // user message
 *   title?: string,             // optional initial title when creating
 *   mentions?: { kind: string, id: string, label: string }[]
 * }
 *
 * Streams newline-delimited JSON events:
 *   {"type":"start","chat_id":"..."}
 *   {"type":"token","text":"..."}
 *   {"type":"complete","message_id":"...","content":"..."}
 *   {"type":"error","message":"..."}
 */
import { type NextRequest } from "next/server";
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { buildSystemPrompt } from "@/lib/chat-context";
import { runChatPostTools, type ChatContent } from "@/lib/chat-post-tools";
import { SHOW_BOOST_VARIATIONS_TOOL } from "@/lib/tools";
import { streamOpenRouter, type ORMessage } from "@/lib/openrouter";
import type { Chat } from "@/lib/types-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const geminiApiKey = process.env.GEMINI_API_KEY!;
const openrouterApiKey = process.env.OPENROUTER_API_KEY || "";

// Model routing — `regular` = cheap/fast workhorse, `max` = highest quality.
const MODEL_BY_MODE: Record<"regular" | "max", string> = {
  regular:
    process.env.CHAT_MODEL_REGULAR ||
    (openrouterApiKey ? "deepseek/deepseek-v3.1" : "gemini-3.5-flash"),
  max: process.env.CHAT_MODEL_MAX || "gemini-3.5-flash",
};

type Event =
  | { type: "start"; chat_id: string }
  | { type: "token"; text: string }
  | { type: "tool-call"; name: string; args: unknown }
  | { type: "reasoning-delta"; delta: string }
  | { type: "complete"; message_id: string; content: string }
  | { type: "error"; message: string };

function ev(e: Event): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(e) + "\n");
}

function evString(e: Event): string {
  return JSON.stringify(e) + "\n";
}

function geminiChunkText(chunk: {
  text?: string;
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}): string {
  if (chunk.text) return chunk.text;
  const parts = chunk.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("");
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    chat_id?: string;
    context_kind?: string;
    context_id?: string;
    voice_id?: string | null;
    message: string;
    title?: string;
    mentions?: { kind: string; id: string; label: string }[];
    system_prompt?: string; // overrides built-in system prompt
    tool?: string; // preferred tool name to surface (e.g. "showBoostVariations")
    mode?: "regular" | "max";
    attachments?: { name: string; mimeType: string; dataBase64: string }[];
  };
  const mode: "regular" | "max" = body.mode === "max" ? "max" : "regular";
  const hasAttachments =
    Array.isArray(body.attachments) && body.attachments.length > 0;
  // Attachments (images / PDFs) need a multimodal model — route to Gemini and
  // skip OpenRouter (the regular text model can't see files).
  const selectedModel = hasAttachments
    ? process.env.CHAT_MODEL_VISION || "gemini-2.5-flash"
    : MODEL_BY_MODE[mode];
  const useOpenRouter =
    !hasAttachments && !!openrouterApiKey && selectedModel.includes("/");
  if (!body.message?.trim()) {
    return new Response(
      evString({ type: "error", message: "message required" }),
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const sb = getSupabase();
  const ws = await getWorkspaceContext();

  let chat: Chat;
  if (body.chat_id) {
    const { data } = await sb
      .from("chats")
      .select("*")
      .eq("id", body.chat_id)
      .maybeSingle();
    if (!data) {
      return new Response(
        evString({ type: "error", message: "chat not found" }),
        { status: 404, headers: { "Content-Type": "application/x-ndjson" } }
      );
    }
    chat = data as Chat;
    if (body.voice_id !== undefined && body.voice_id !== chat.voice_id) {
      await sb.from("chats").update({ voice_id: body.voice_id }).eq("id", chat.id);
      chat.voice_id = body.voice_id;
    }
  } else {
    if (!ws.workspaceId) {
      return new Response(
        evString({ type: "error", message: "no workspace" }),
        { status: 500, headers: { "Content-Type": "application/x-ndjson" } }
      );
    }
    const ins = await sb
      .from("chats")
      .insert({
        workspace_id: ws.workspaceId,
        title: (body.title || body.message).slice(0, 80),
        voice_id: body.voice_id || null,
        context_kind: body.context_kind || "freeform",
        context_id: body.context_id || null,
      })
      .select("*")
      .single();
    if (ins.error || !ins.data) {
      return new Response(
        evString({ type: "error", message: ins.error?.message || "create failed" }),
        { status: 500, headers: { "Content-Type": "application/x-ndjson" } }
      );
    }
    chat = ins.data as Chat;
  }

  // Persist the user message
  await sb.from("chat_messages").insert({
    chat_id: chat.id,
    role: "user",
    content_md: body.message,
    mentions: body.mentions ? { items: body.mentions } : null,
  });

  // Build history + system prompt
  const { data: history } = await sb
    .from("chat_messages")
    .select("role, content_md")
    .eq("chat_id", chat.id)
    .order("created_at", { ascending: true });
  const msgs = (history || []) as { role: string; content_md: string }[];
  const systemPrompt = await buildSystemPrompt(chat);

  // Append mentions context to the latest user message
  let extra = "";
  if (body.mentions && body.mentions.length > 0) {
    extra = await buildMentionsSection(body.mentions);
  }
  type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };
  const contents: { role: "model" | "user"; parts: GeminiPart[] }[] = msgs.map(
    (m, i) => {
      const isLast = i === msgs.length - 1;
      const text =
        isLast && extra ? `${m.content_md}\n\n${extra}` : m.content_md;
      return {
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text }],
      };
    }
  );

  // Attach uploaded files (images / PDFs) to the latest user message so the
  // model can see them. Inline base64 — Gemini only.
  if (hasAttachments && contents.length > 0) {
    const last = contents[contents.length - 1];
    for (const a of body.attachments!) {
      last.parts.push({
        inlineData: { mimeType: a.mimeType, data: a.dataBase64 },
      });
    }
  }

  // System prompt: use override if supplied, else the default builder.
  const effectiveSystemPrompt = body.system_prompt?.trim() || systemPrompt;

  // Tool config — currently only one tool exists (showBoostVariations).
  type ToolConfigShape = {
    tools: { functionDeclarations: object[] }[];
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode;
        allowedFunctionNames?: string[];
      };
    };
  };
  let toolConfig: ToolConfigShape | null = null;
  if (body.tool === "showBoostVariations") {
    toolConfig = {
      tools: [{ functionDeclarations: [SHOW_BOOST_VARIATIONS_TOOL] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["showBoostVariations"],
        },
      },
    };
  }

  // On-demand post tools — for creator_post chats, let the model fetch the
  // transcript / vision analysis when asked. Only offer a tool if that data
  // isn't already on the post (once fetched it's cached + in the context).
  let postToolAllow: { transcript: boolean; vision: boolean } | null = null;
  if (chat.context_kind === "creator_post" && chat.context_id && !body.tool) {
    const { data: pc } = await sb
      .from("creator_posts")
      .select("transcript, vision_analysis_md, ai_overview")
      .eq("id", chat.context_id)
      .maybeSingle();
    const r = (pc || {}) as {
      transcript?: string | null;
      vision_analysis_md?: string | null;
      ai_overview?: unknown;
    };
    const allowT = !r.transcript;
    const allowV = !r.vision_analysis_md && !r.ai_overview;
    if (allowT || allowV) postToolAllow = { transcript: allowT, vision: allowV };
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(ev({ type: "start", chat_id: chat.id }));
      let assembled = "";

      // Run post tools first if relevant, then inject results into the context
      // before the main generation so the model answers with the fetched data.
      if (postToolAllow && chat.context_id) {
        try {
          const { note } = await runChatPostTools({
            ai,
            postId: chat.context_id,
            contents: contents as ChatContent[],
            systemPrompt: effectiveSystemPrompt,
            allow: postToolAllow,
            onToolStart: (names) => {
              const label = names
                .map((n) =>
                  n === "fetch_transcript" ? "transcript" : "visual analysis"
                )
                .join(" + ");
              const note = `_Fetching ${label}…_\n\n`;
              assembled += note;
              controller.enqueue(ev({ type: "token", text: note }));
            },
          });
          if (note) {
            // Inject into the Gemini `contents` (already built) AND `extra`
            // (consumed by the OpenRouter path when it builds its messages).
            const last = contents[contents.length - 1];
            if (last) {
              const textPart = last.parts.find(
                (p): p is { text: string } => "text" in p
              );
              if (textPart) {
                textPart.text = `${textPart.text}\n\n${note}`;
              } else {
                last.parts.unshift({ text: note });
              }
            }
            extra = extra ? `${extra}\n\n${note}` : note;
          }
        } catch {
          /* tools are best-effort — fall through to a normal answer */
        }
      }
      let reasoning = "";
      const toolCalls: { name: string; args: unknown }[] = [];

      try {
        if (useOpenRouter) {
          // OpenRouter path — supports DeepSeek + Anthropic + GPT, with
          // reasoning streamed separately.
          const orMessages: ORMessage[] = msgs.map((m, i) => ({
            role:
              m.role === "assistant"
                ? ("assistant" as const)
                : ("user" as const),
            content:
              i === msgs.length - 1 && extra
                ? `${m.content_md}\n\n${extra}`
                : m.content_md,
          }));
          const orTools =
            body.tool === "showBoostVariations"
              ? [
                  {
                    type: "function" as const,
                    function: {
                      name: "showBoostVariations",
                      description:
                        "Render 3-5 ready-to-publish post variations as cards.",
                      parameters: {
                        type: "object",
                        required: ["variations"],
                        properties: {
                          variations: {
                            type: "array",
                            minItems: 3,
                            maxItems: 5,
                            items: {
                              type: "object",
                              required: ["label", "body", "why"],
                              properties: {
                                label: { type: "string" },
                                body: { type: "string" },
                                why: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ]
              : undefined;
          for await (const e of streamOpenRouter({
            apiKey: openrouterApiKey,
            model: selectedModel,
            messages: orMessages,
            systemInstruction: effectiveSystemPrompt || undefined,
            temperature: 0.7,
            tools: orTools,
            toolChoice:
              body.tool === "showBoostVariations"
                ? {
                    type: "function",
                    function: { name: "showBoostVariations" },
                  }
                : undefined,
          })) {
            if (e.type === "reasoning-delta") {
              reasoning += e.delta;
              controller.enqueue(ev({ type: "reasoning-delta", delta: e.delta }));
            } else if (e.type === "text-delta") {
              assembled += e.delta;
              controller.enqueue(ev({ type: "token", text: e.delta }));
            } else if (e.type === "tool-call") {
              toolCalls.push({ name: e.name, args: e.args });
              controller.enqueue(ev({ type: "tool-call", name: e.name, args: e.args }));
              assembled +=
                "\n\n```tool:" +
                e.name +
                "\n" +
                JSON.stringify(e.args) +
                "\n```\n";
            }
          }
        } else {
          const streamResp = await ai.models.generateContentStream({
            model: selectedModel,
            contents,
            config: {
              ...(effectiveSystemPrompt
                ? {
                    systemInstruction: {
                      parts: [{ text: effectiveSystemPrompt }],
                    },
                  }
                : {}),
              ...(toolConfig || {}),
              temperature: 0.7,
            },
          });
          for await (const chunk of streamResp) {
            const calls = chunk.functionCalls;
            if (calls && calls.length > 0) {
              for (const c of calls) {
                const name = c.name || "";
                const args = c.args || {};
                toolCalls.push({ name, args });
                controller.enqueue(ev({ type: "tool-call", name, args }));
                assembled +=
                  "\n\n```tool:" +
                  name +
                  "\n" +
                  JSON.stringify(args) +
                  "\n```\n";
              }
            }
            const text = geminiChunkText(chunk);
            if (text) {
              assembled += text;
              controller.enqueue(ev({ type: "token", text }));
            }
          }
        }
        if (!assembled && toolCalls.length === 0) {
          controller.enqueue(ev({ type: "error", message: "empty response" }));
          controller.close();
          return;
        }
        const { data: assistantRow } = await sb
          .from("chat_messages")
          .insert({
            chat_id: chat.id,
            role: "assistant",
            content_md: assembled,
            tool_calls: toolCalls.length > 0 ? toolCalls : null,
            thoughts_md: reasoning || null,
          })
          .select("id")
          .single();
        const assistantId = (assistantRow as { id: string } | null)?.id || "";
        if (chat.title === "New chat" && body.message) {
          await sb
            .from("chats")
            .update({
              title: body.message.slice(0, 80),
              updated_at: new Date().toISOString(),
            })
            .eq("id", chat.id);
        } else {
          await sb
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", chat.id);
        }
        controller.enqueue(
          ev({ type: "complete", message_id: assistantId, content: assembled })
        );
        controller.close();
      } catch (e) {
        controller.enqueue(ev({ type: "error", message: String(e) }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

async function buildMentionsSection(
  mentions: { kind: string; id: string; label: string }[]
): Promise<string> {
  const sb = getSupabase();
  const parts: string[] = ["## Mentioned context"];
  for (const m of mentions) {
    if (m.kind === "post") {
      const { data } = await sb
        .from("creator_posts")
        .select("title_or_caption, url, vision_analysis_md, creator:creators(handle)")
        .eq("id", m.id)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        parts.push(
          `\n### @${m.label} (post)\nURL: ${d.url}\nCaption: ${(d.title_or_caption as string)?.slice(0, 300) || "(none)"}\n${
            d.vision_analysis_md
              ? `Vision: ${(d.vision_analysis_md as string).slice(0, 800)}`
              : ""
          }`
        );
      }
    } else if (m.kind === "creator") {
      const { data } = await sb
        .from("creators")
        .select("handle, display_name, platform, bio, follower_count")
        .eq("id", m.id)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        parts.push(
          `\n### @${m.label} (creator)\n${d.platform} · ${d.follower_count} followers\n${(d.bio as string) || ""}`
        );
      }
    } else if (m.kind === "list") {
      const { data } = await sb
        .from("creator_lists")
        .select("name, description")
        .eq("id", m.id)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        parts.push(`\n### List: ${d.name}\n${(d.description as string) || ""}`);
      }
    }
  }
  return parts.join("\n");
}
