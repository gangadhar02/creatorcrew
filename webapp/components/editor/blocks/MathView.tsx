"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/** Render a LaTeX string as display math via KaTeX (never throws). */
export default function MathView({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex || "", {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return "";
    }
  }, [tex]);

  if (!tex.trim()) {
    return (
      <div className="rounded bg-muted/40 px-3 py-3 text-center text-sm text-muted-foreground/60">
        Empty equation
      </div>
    );
  }
  return (
    <div
      className="overflow-x-auto rounded bg-muted/40 px-3 py-2 text-center"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
