import { type Block, type BlockType, newBlockId } from "./types";

/**
 * Parse a markdown string into a flat Block[]. Line-based (with multi-line
 * fenced code) so it round-trips exactly with serialize(). Each line becomes a
 * block; list items are one block each.
 */
export function parse(md: string): Block[] {
  const text = md ?? "";
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence (or EOF)
      blocks.push({ id: newBlockId(), type: "code", text: body.join("\n") });
      continue;
    }

    // Math block ($$ ... $$).
    if (/^\$\$\s*$/.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ id: newBlockId(), type: "math", text: body.join("\n") });
      continue;
    }

    // GFM table (consecutive lines starting with "|").
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ id: newBlockId(), type: "table", text: body.join("\n") });
      continue;
    }

    // Standalone image: ![alt](url)
    if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(line)) {
      blocks.push({ id: newBlockId(), type: "image", text: line });
      i += 1;
      continue;
    }

    let type: BlockType = "paragraph";
    let body = line;

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ id: newBlockId(), type: "divider", text: "" });
      i += 1;
      continue;
    } else if (line.startsWith("### ")) {
      type = "h3";
      body = line.slice(4);
    } else if (line.startsWith("## ")) {
      type = "h2";
      body = line.slice(3);
    } else if (line.startsWith("# ")) {
      type = "h1";
      body = line.slice(2);
    } else if (line.startsWith("> ")) {
      type = "quote";
      body = line.slice(2);
    } else if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /^[-*]\s+\[[xX]\]/.test(line);
      blocks.push({
        id: newBlockId(),
        type: "checklist",
        text: line.replace(/^[-*]\s+\[[ xX]\]\s+/, ""),
        checked,
      });
      i += 1;
      continue;
    } else if (/^[-*]\s+/.test(line)) {
      type = "bullet";
      body = line.replace(/^[-*]\s+/, "");
    } else if (/^\d+\.\s+/.test(line)) {
      type = "numbered";
      body = line.replace(/^\d+\.\s+/, "");
    }

    blocks.push({ id: newBlockId(), type, text: body });
    i += 1;
  }

  if (blocks.length === 0) blocks.push({ id: newBlockId(), type: "paragraph", text: "" });
  return blocks;
}
