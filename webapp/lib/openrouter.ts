/**
 * OpenRouter streaming adapter.
 *
 * OpenRouter is OpenAI-compatible; we hit `chat/completions` with stream=true
 * and translate each SSE chunk into our internal event shape. Some models
 * (DeepSeek V4 Pro, Anthropic, etc.) emit reasoning content alongside the
 * final text via `delta.reasoning` — we surface those separately so the UI
 * can render a collapsible "Thoughts" section.
 */

export type ORMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OREvent =
  | { type: "reasoning-delta"; delta: string }
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; name: string; args: unknown }
  | { type: "finish" };

const OR_BASE = "https://openrouter.ai/api/v1";

export async function* streamOpenRouter({
  apiKey,
  model,
  messages,
  systemInstruction,
  temperature = 0.7,
  tools,
  toolChoice,
}: {
  apiKey: string;
  model: string;
  messages: ORMessage[];
  systemInstruction?: string;
  temperature?: number;
  tools?: {
    type: "function";
    function: { name: string; description: string; parameters: object };
  }[];
  toolChoice?: { type: "function"; function: { name: string } };
}): AsyncGenerator<OREvent, void, void> {
  const finalMessages: ORMessage[] = systemInstruction
    ? [{ role: "system", content: systemInstruction }, ...messages]
    : messages;

  const res = await fetch(`${OR_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://saves-engine.local",
      "X-Title": "Saves Engine",
    },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      stream: true,
      temperature,
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Tool calls arrive incrementally — we accumulate them across deltas and
  // emit a single tool-call event per call when finishing.
  type ToolAccum = {
    id?: string;
    name?: string;
    argsBuffer: string;
  };
  const toolAccum: Record<number, ToolAccum> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        // Flush any complete tool calls
        for (const t of Object.values(toolAccum)) {
          if (t.name && t.argsBuffer) {
            let args: unknown = {};
            try {
              args = JSON.parse(t.argsBuffer);
            } catch {
              args = { _raw: t.argsBuffer };
            }
            yield { type: "tool-call", name: t.name, args };
          }
        }
        yield { type: "finish" };
        return;
      }
      try {
        const obj = JSON.parse(payload) as {
          choices?: {
            delta?: {
              content?: string;
              reasoning?: string;
              reasoning_content?: string;
              tool_calls?: {
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
          }[];
        };
        const delta = obj.choices?.[0]?.delta;
        if (!delta) continue;
        const reasoning = delta.reasoning || delta.reasoning_content;
        if (reasoning) yield { type: "reasoning-delta", delta: reasoning };
        if (delta.content) yield { type: "text-delta", delta: delta.content };
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolAccum[idx]) toolAccum[idx] = { argsBuffer: "" };
            if (tc.function?.name) toolAccum[idx].name = tc.function.name;
            if (tc.function?.arguments)
              toolAccum[idx].argsBuffer += tc.function.arguments;
            if (tc.id) toolAccum[idx].id = tc.id;
          }
        }
      } catch {
        /* partial JSON */
      }
    }
  }
}
