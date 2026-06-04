/**
 * Block model for the custom markdown editor.
 *
 * A document is a flat list of Blocks. Each block maps to one markdown
 * construct. Lists are per-item blocks (Eden-style), so reordering and caret
 * handling stay simple. `code` and `paragraph` blocks may contain newlines;
 * everything else is single-line.
 */
export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "code"
  | "table"
  | "image"
  | "math"
  | "divider";

export type Block = {
  id: string;
  type: BlockType;
  text: string;
  /** Only used by checklist blocks. */
  checked?: boolean;
};

let blockCounter = 0;
export function newBlockId(): string {
  blockCounter += 1;
  return `b${blockCounter}-${Math.floor(performance.now())}`;
}

export function emptyBlock(type: BlockType = "paragraph"): Block {
  return { id: newBlockId(), type, text: "" };
}

/** Block types whose markdown prefix should be visible/handled per-line. */
export const PREFIXED: Partial<Record<BlockType, string>> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  bullet: "- ",
  numbered: "1. ",
  quote: "> ",
};
