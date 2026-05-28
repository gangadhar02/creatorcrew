/**
 * Client-side helper for consuming the /api/chat ndjson stream.
 * Calls onToken with each token chunk as it streams, and resolves with the
 * final chat_id + assistant content once the "complete" event arrives.
 */

export type ChatStreamEvent =
  | { type: "start"; chat_id: string }
  | { type: "token"; text: string }
  | { type: "complete"; message_id: string; content: string }
  | { type: "error"; message: string };

export type ChatStreamResult = {
  chat_id: string;
  message_id: string;
  content: string;
};

/** Parse newline-delimited JSON events from a fetch response body. */
export async function readNdjsonStream<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (ev: T) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function flushLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as T);
    } catch {
      /* ignore partial / malformed lines */
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) flushLine(line);
    }
    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) flushLine(buffer);
      break;
    }
  }
}

export async function streamChat(
  body: Record<string, unknown>,
  callbacks: {
    onStart?: (chatId: string) => void;
    onToken?: (text: string) => void;
    onError?: (message: string) => void;
  } = {}
): Promise<ChatStreamResult | null> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) {
    callbacks.onError?.("no response body");
    return null;
  }
  let chatId = "";
  let finalContent = "";
  let finalMessageId = "";
  let errored: string | null = null;
  await readNdjsonStream<ChatStreamEvent>(res.body, (ev) => {
    if (ev.type === "start") {
      chatId = ev.chat_id;
      callbacks.onStart?.(ev.chat_id);
    } else if (ev.type === "token") {
      callbacks.onToken?.(ev.text);
    } else if (ev.type === "complete") {
      finalContent = ev.content;
      finalMessageId = ev.message_id;
    } else if (ev.type === "error") {
      errored = ev.message;
      callbacks.onError?.(ev.message);
    }
  });
  if (errored) return null;
  return {
    chat_id: chatId,
    message_id: finalMessageId,
    content: finalContent,
  };
}
