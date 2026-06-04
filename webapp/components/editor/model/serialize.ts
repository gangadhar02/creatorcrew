import { type Block } from "./types";

/**
 * Serialize Block[] back to a markdown string. Inverse of parse(). Numbered
 * lists are renumbered sequentially within a contiguous run.
 */
export function serialize(blocks: Block[]): string {
  const out: string[] = [];
  let numberCounter = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const prev = blocks[i - 1];
    if (b.type !== "numbered") numberCounter = 0;

    switch (b.type) {
      case "h1":
        out.push(`# ${b.text}`);
        break;
      case "h2":
        out.push(`## ${b.text}`);
        break;
      case "h3":
        out.push(`### ${b.text}`);
        break;
      case "bullet":
        out.push(`- ${b.text}`);
        break;
      case "checklist":
        out.push(`- [${b.checked ? "x" : " "}] ${b.text}`);
        break;
      case "numbered":
        if (prev?.type === "numbered") numberCounter += 1;
        else numberCounter = 1;
        out.push(`${numberCounter}. ${b.text}`);
        break;
      case "quote":
        out.push(`> ${b.text}`);
        break;
      case "divider":
        out.push("---");
        break;
      case "code":
        out.push("```");
        out.push(b.text);
        out.push("```");
        break;
      case "math":
        out.push("$$");
        out.push(b.text);
        out.push("$$");
        break;
      case "table":
        out.push(b.text);
        break;
      case "image":
        out.push(b.text);
        break;
      case "paragraph":
      default:
        out.push(b.text);
        break;
    }
  }
  return out.join("\n");
}
