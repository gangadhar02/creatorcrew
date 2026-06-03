/**
 * Recover tool calls that a model emitted as TEXT instead of as a real
 * function call, and strip the legacy ```tool:<name>``` fenced blocks out of
 * conversation history so the model stops imitating that format.
 *
 * Background: an earlier version embedded each tool call into the assistant's
 * content_md as a ```tool:<name>\n<json>\n``` block. That text got fed back as
 * history, which taught the model to "type out" tool calls as fenced text
 * instead of invoking the function. These helpers both (a) sanitize history and
 * (b) convert any such text blocks back into structured tool calls at runtime.
 *
 * The parser is brace-matched (string-aware), so a JSON arg value that itself
 * contains ``` fences or braces does not break extraction.
 */

const MARKER = "```tool:";

export type ExtractedToolCall = { name: string; args: unknown };

/** Find the index of the `}` matching the `{` at `open`, respecting strings. */
function matchBrace(text: string, open: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extract ```tool:<name>{...}``` blocks from `text`.
 * Returns the text with those blocks removed plus the parsed calls. Blocks that
 * fail to parse are left in place (no data loss) and not returned as calls.
 */
export function extractToolCalls(text: string): {
  cleaned: string;
  calls: ExtractedToolCall[];
} {
  if (!text || !text.includes(MARKER)) return { cleaned: text, calls: [] };
  const calls: ExtractedToolCall[] = [];
  let out = "";
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf(MARKER, i);
    if (start === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, start);

    // Tool name runs from after the marker to the next newline or backtick.
    let j = start + MARKER.length;
    let name = "";
    while (j < text.length && text[j] !== "\n" && text[j] !== "`") {
      name += text[j];
      j++;
    }
    name = name.trim();

    const braceStart = text.indexOf("{", j);
    if (braceStart === -1) {
      // Malformed: keep the marker text as-is and stop.
      out += text.slice(start);
      break;
    }
    const braceEnd = matchBrace(text, braceStart);
    if (braceEnd === -1) {
      out += text.slice(start);
      break;
    }

    const jsonStr = text.slice(braceStart, braceEnd + 1);
    let args: unknown = null;
    try {
      args = JSON.parse(jsonStr);
    } catch {
      args = null;
    }

    // Skip a trailing closing fence if it's right after the JSON.
    let after = braceEnd + 1;
    const fenceClose = text.indexOf("```", after);
    if (fenceClose !== -1 && text.slice(after, fenceClose).trim() === "") {
      after = fenceClose + 3;
    }

    if (args && name) {
      calls.push({ name, args });
    } else {
      // Parse failed: preserve the original text rather than dropping it.
      out += text.slice(start, after);
    }
    i = after;
  }

  return { cleaned: out.trim(), calls };
}

/** Strip ```tool:...``` blocks from text (used to sanitize history). */
export function stripToolFences(text: string): string {
  return extractToolCalls(text).cleaned;
}
