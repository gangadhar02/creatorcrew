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
import {
  SHOW_BOOST_VARIATIONS_TOOL,
  AUTO_TOOLS_GEMINI,
  AUTO_TOOLS_OPENROUTER,
  DATA_TOOL_NAMES,
} from "@/lib/tools";
import { streamOpenRouter, type ORMessage } from "@/lib/openrouter";
import { extractToolCalls, stripToolFences } from "@/lib/tool-text";
import { getCreatorDataForChat } from "@/lib/creator-data";
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
  // Sanitize history: strip any legacy ```tool:...``` fenced blocks from prior
  // assistant turns. Feeding those back taught the model to "type out" tool
  // calls as text instead of invoking the function. Cards rehydrate from the
  // tool_calls column, so the model never needs to see this format.
  const msgs = ((history || []) as { role: string; content_md: string }[]).map(
    (m) =>
      m.role === "assistant"
        ? { ...m, content_md: stripToolFences(m.content_md || "") }
        : m
  );
  const systemPrompt = await buildSystemPrompt(chat);

  // Append mentions context to the latest user message
  let extra = "";
  if (body.mentions && body.mentions.length > 0) {
    extra = await buildMentionsSection(body.mentions);
  }
  type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
    | {
        functionCall: { name: string; args: Record<string, unknown> };
        thoughtSignature?: string;
      }
    | { functionResponse: { name: string; response: Record<string, unknown> } };
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
    // Forced mode (unchanged behavior): the Boost button must produce variations.
    toolConfig = {
      tools: [{ functionDeclarations: [SHOW_BOOST_VARIATIONS_TOOL] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["showBoostVariations"],
        },
      },
    };
  } else if (!body.tool) {
    // Auto mode: offer all generative-UI tools, model chooses 0 or more.
    // Note: Gemini rejects allowedFunctionNames unless mode is ANY, so in AUTO
    // mode we only declare the tools and let the model pick freely.
    toolConfig = {
      tools: [{ functionDeclarations: AUTO_TOOLS_GEMINI }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
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
              ? AUTO_TOOLS_OPENROUTER.filter(
                  (t) => t.function.name === "showBoostVariations"
                )
              : !body.tool
                ? AUTO_TOOLS_OPENROUTER
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
              // Tool calls are persisted separately in `tool_calls` and rendered
              // as cards from there. Do NOT embed them into content_md: the args
              // can contain markdown with ``` fences, which breaks stripping and
              // leaks raw JSON into the rendered message.
              toolCalls.push({ name: e.name, args: e.args });
              controller.enqueue(ev({ type: "tool-call", name: e.name, args: e.args }));
            }
          }
        } else {
          // Gemini path with a DATA-tool execution loop. Render tools
          // (creatorSnapshot, draftDocument, ...) are terminal and emitted to
          // the client. DATA tools (getCreatorData) are executed server-side and
          // their result is fed back so the model can render cards from real
          // numbers. Loop until the model stops requesting data (bounded).
          const dataToolNames = new Set<string>(DATA_TOOL_NAMES);
          const MAX_TOOL_ROUNDS = 4;
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
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
            // Keep the raw model parts for data-tool calls so we can echo them
            // back verbatim. Gemini 3 attaches a thought_signature to each
            // functionCall part that MUST be preserved when the call is sent
            // back with its response, or the next call 400s.
            const dataCalls: {
              name: string;
              args: Record<string, unknown>;
              part: GeminiPart;
            }[] = [];
            for await (const chunk of streamResp) {
              const parts = chunk.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.functionCall) {
                  const name = part.functionCall.name || "";
                  const args = (part.functionCall.args ||
                    {}) as Record<string, unknown>;
                  if (dataToolNames.has(name)) {
                    // Execute server-side and feed back; do not show to user.
                    dataCalls.push({
                      name,
                      args,
                      part: part as unknown as GeminiPart,
                    });
                  } else {
                    // Render tool: terminal, surfaced as a card.
                    toolCalls.push({ name, args });
                    controller.enqueue(ev({ type: "tool-call", name, args }));
                  }
                } else if (part.text && !part.thought) {
                  assembled += part.text;
                  controller.enqueue(ev({ type: "token", text: part.text }));
                }
              }
            }

            if (dataCalls.length === 0) break;

            // Echo the model's data-tool call parts verbatim (preserving
            // thought_signature), then append their results, and loop so the
            // model continues with real data in context.
            contents.push({
              role: "model",
              parts: dataCalls.map((c) => c.part),
            });
            const responseParts: GeminiPart[] = [];
            for (const c of dataCalls) {
              const handle =
                (c.args as { handle?: string } | null)?.handle || "";
              // Transient status note (streamed for feedback, not persisted).
              controller.enqueue(
                ev({ type: "token", text: `_Looking up @${handle}…_\n\n` })
              );
              let result: unknown = { error: "unknown tool" };
              if (c.name === "getCreatorData") {
                try {
                  result = await getCreatorDataForChat(handle, ws.workspaceId);
                } catch (err) {
                  result = { error: String(err) };
                }
              }
              responseParts.push({
                functionResponse: {
                  name: c.name,
                  response: (result ?? {}) as Record<string, unknown>,
                },
              });
            }
            contents.push({ role: "user", parts: responseParts });
          }
        }
        // Fallback: if the model emitted a tool call as text (a ```tool:<name>
        // {json}``` block) instead of a real function call, recover it. Convert
        // each into a structured tool call, surface it as a card, and strip it
        // from the persisted/displayed text so no raw JSON leaks through.
        if (assembled.includes("```tool:")) {
          const { cleaned, calls } = extractToolCalls(assembled);
          if (calls.length > 0) {
            for (const c of calls) {
              toolCalls.push(c);
              controller.enqueue(
                ev({ type: "tool-call", name: c.name, args: c.args })
              );
            }
            assembled = cleaned;
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
