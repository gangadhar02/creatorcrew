import { type Block, type BlockType } from "./types";

/**
 * Markdown autoformat: when the user types a shortcut at the start of a
 * paragraph block (e.g. "# ", "- ", "1. ", "> ", "```", "---"), return the new
 * block type and the remaining text (prefix stripped). Returns null if no
 * shortcut matched. Caller resets the caret to position 0 of the stripped text.
 */
export function detectAutoformat(
  text: string
): { type: BlockType; text: string; checked?: boolean } | null {
  if (/^# /.test(text)) return { type: "h1", text: text.slice(2) };
  if (/^## /.test(text)) return { type: "h2", text: text.slice(3) };
  if (/^### /.test(text)) return { type: "h3", text: text.slice(4) };
  if (/^> /.test(text)) return { type: "quote", text: text.slice(2) };
  if (/^\[[ xX]?\] /.test(text)) {
    const checked = /^\[[xX]\] /.test(text);
    return { type: "checklist", text: text.replace(/^\[[ xX]?\] /, ""), checked };
  }
  if (/^[-*] /.test(text)) return { type: "bullet", text: text.slice(2) };
  const num = text.match(/^(\d+)\. /);
  if (num) return { type: "numbered", text: text.slice(num[0].length) };
  if (/^```/.test(text)) return { type: "code", text: text.slice(3) };
  if (/^(---|\*\*\*)$/.test(text)) return { type: "divider", text: "" };
  return null;
}

/** List/quote types that continue to a new block of the same type on Enter. */
export function continuationType(type: BlockType): BlockType {
  if (type === "bullet" || type === "numbered" || type === "checklist") return type;
  return "paragraph";
}

export function isListLike(type: BlockType): boolean {
  return type === "bullet" || type === "numbered" || type === "checklist";
}

/** Replace one block by id. */
export function setBlock(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

export function indexOf(blocks: Block[], id: string): number {
  return blocks.findIndex((b) => b.id === id);
}
