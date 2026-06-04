"use client";

import { useEffect, useRef } from "react";
import MarkdownView from "@/components/MarkdownView";
import { serialize } from "../model/serialize";
import { type Block } from "../model/types";
import MathView from "./MathView";

const TEXTAREA_CLASS: Record<string, string> = {
  h1: "text-3xl font-bold",
  h2: "text-2xl font-semibold",
  h3: "text-xl font-semibold",
  quote: "italic text-muted-foreground",
  code: "font-mono text-sm",
  bullet: "text-base",
  numbered: "text-base",
  paragraph: "text-base",
};

const PLACEHOLDER: Record<string, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  quote: "Quote",
  code: "Code",
  bullet: "List item",
  numbered: "List item",
  paragraph: "Type '/' for commands…",
};

export default function BlockView({
  block,
  focused,
  onFocus,
  onChange,
  onToggle,
  onKeyDown,
  registerRef,
}: {
  block: Block;
  focused: boolean;
  onFocus: () => void;
  onChange: (text: string) => void;
  onToggle?: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize the textarea to its content.
  const resize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    if (focused) resize();
  }, [focused, block.text]);

  // Checklist always shows a live checkbox; the text is a textarea when focused
  // and rendered (struck through if checked) otherwise.
  if (block.type === "checklist") {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <input
          type="checkbox"
          checked={!!block.checked}
          onChange={onToggle}
          className="mt-1.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
        />
        {focused ? (
          <textarea
            ref={(el) => {
              taRef.current = el;
              registerRef(el);
            }}
            value={block.text}
            rows={1}
            placeholder="To-do"
            onFocus={onFocus}
            onChange={(e) => {
              onChange(e.target.value);
              resize();
            }}
            onKeyDown={onKeyDown}
            className={
              "w-full resize-none overflow-hidden bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/50 " +
              (block.checked ? "text-muted-foreground line-through" : "")
            }
          />
        ) : (
          <div
            onClick={onFocus}
            className={
              "min-h-[1.6em] flex-1 cursor-text " +
              (block.checked ? "text-muted-foreground line-through" : "")
            }
          >
            {block.text.trim() === "" ? (
              <span className="text-muted-foreground/50">To-do</span>
            ) : (
              block.text
            )}
          </div>
        )}
      </div>
    );
  }

  // Image block: render the image; edit the markdown source when focused.
  if (block.type === "image") {
    const m = block.text.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    const url = m?.[2];
    if (!focused) {
      return (
        <div onClick={onFocus} className="cursor-pointer py-1">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={m?.[1] || ""} className="max-h-[420px] rounded-lg" />
          ) : (
            <span className="text-muted-foreground/50">Image (click to set URL)</span>
          )}
        </div>
      );
    }
    return (
      <input
        ref={(el) => registerRef(el as unknown as HTMLTextAreaElement)}
        value={block.text}
        placeholder="![alt](https://image-url)"
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown as unknown as React.KeyboardEventHandler<HTMLInputElement>}
        className="w-full rounded bg-muted/50 px-2 py-1 font-mono text-sm outline-none"
      />
    );
  }

  // Math + Table + Code share a multi-line "source when focused, rendered when
  // blurred" model.
  if (block.type === "math" || block.type === "table") {
    if (!focused) {
      return (
        <div onClick={onFocus} className="cursor-text py-1">
          {block.type === "math" ? (
            <MathView tex={block.text} />
          ) : block.text.trim() ? (
            <MarkdownView>{block.text}</MarkdownView>
          ) : (
            <span className="text-muted-foreground/50">Empty table (click to edit)</span>
          )}
        </div>
      );
    }
    return (
      <div className={block.type === "math" ? "rounded bg-muted/50 px-3 py-2" : ""}>
        <textarea
          ref={(el) => {
            taRef.current = el;
            registerRef(el);
          }}
          value={block.text}
          rows={block.type === "table" ? 3 : 1}
          placeholder={
            block.type === "math"
              ? "\\int_0^\\infty e^{-x}\\,dx"
              : "| Col A | Col B |\n| --- | --- |\n| a | b |"
          }
          onFocus={onFocus}
          onChange={(e) => {
            onChange(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          className="w-full resize-none overflow-hidden bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40"
        />
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <div
        tabIndex={0}
        onFocus={onFocus}
        onClick={onFocus}
        className={
          "my-2 cursor-pointer rounded outline-none " +
          (focused ? "ring-2 ring-primary/40" : "")
        }
      >
        <hr className="border-border" />
      </div>
    );
  }

  if (!focused) {
    const md = serialize([block]);
    return (
      <div
        onClick={onFocus}
        className={
          "cursor-text px-0.5 py-0.5 " +
          (block.text.trim() === "" ? "min-h-[1.6em]" : "")
        }
      >
        {block.text.trim() === "" ? (
          <span className="text-muted-foreground/50">
            {PLACEHOLDER[block.type] ?? ""}
          </span>
        ) : (
          <MarkdownView>{md}</MarkdownView>
        )}
      </div>
    );
  }

  const wrapClass =
    block.type === "quote"
      ? "border-l-2 border-border pl-3"
      : block.type === "code"
        ? "rounded bg-muted/60 px-3 py-2"
        : "";

  const marker =
    block.type === "bullet" ? "• " : block.type === "numbered" ? "1. " : "";

  return (
    <div className={"flex " + wrapClass}>
      {marker && (
        <span className="select-none pr-2 text-muted-foreground">{marker}</span>
      )}
      <textarea
        ref={(el) => {
          taRef.current = el;
          registerRef(el);
        }}
        value={block.text}
        rows={1}
        spellCheck
        placeholder={PLACEHOLDER[block.type] ?? ""}
        onFocus={onFocus}
        onChange={(e) => {
          onChange(e.target.value);
          resize();
        }}
        onKeyDown={onKeyDown}
        className={
          "w-full resize-none overflow-hidden bg-transparent leading-relaxed outline-none placeholder:text-muted-foreground/50 " +
          (TEXTAREA_CLASS[block.type] ?? "text-base")
        }
      />
    </div>
  );
}
