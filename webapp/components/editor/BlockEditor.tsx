"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parse } from "./model/parse";
import { serialize } from "./model/serialize";
import {
  detectAutoformat,
  continuationType,
  isListLike,
} from "./model/blockOps";
import { type Block, type BlockType, emptyBlock } from "./model/types";
import BlockView from "./blocks/BlockView";
import SlashMenu from "./menus/SlashMenu";
import BubbleMenu, { type WrapKind } from "./menus/BubbleMenu";

type PendingFocus = { id: string; pos: number | "end" } | null;

export default function BlockEditor({
  initialMarkdown,
  onChange,
  className,
}: {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
  className?: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => parse(initialMarkdown));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);

  // Mirror current blocks so handlers can read state without stale closures or
  // running side effects inside the setBlocks updater (StrictMode-safe).
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // Slash menu state.
  const [slash, setSlash] = useState<{ id: string; x: number; y: number; query: string } | null>(
    null
  );
  const slashRef = useRef(slash);
  slashRef.current = slash;
  // Inline-format bubble menu (shown over a non-empty text selection).
  const [bubble, setBubble] = useState<{ id: string; x: number; y: number } | null>(null);

  // Track selection inside the focused block's textarea.
  useEffect(() => {
    function onSel() {
      const el = document.activeElement as HTMLTextAreaElement | null;
      const isOurs =
        el &&
        el.tagName === "TEXTAREA" &&
        Object.values(refs.current).includes(el);
      if (isOurs && el!.selectionStart !== el!.selectionEnd) {
        const id = Object.keys(refs.current).find((k) => refs.current[k] === el);
        if (!id) return;
        const r = el!.getBoundingClientRect();
        setBubble({ id, x: r.left + r.width / 2, y: r.top - 6 });
      } else {
        setBubble(null);
      }
    }
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const wrapSelection = useCallback(
    (kind: WrapKind) => {
      if (!bubble) return;
      const ta = refs.current[bubble.id];
      if (!ta) return;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const value = ta.value;
      const selected = value.slice(s, e);
      let before = "";
      let after = "";
      let extra = 0;
      if (kind === "bold") {
        before = after = "**";
      } else if (kind === "italic") {
        before = after = "*";
      } else if (kind === "code") {
        before = after = "`";
      } else if (kind === "link") {
        const url = window.prompt("Link URL");
        if (!url) return;
        before = "[";
        after = `](${url})`;
        extra = 0;
      }
      const next = value.slice(0, s) + before + selected + after + value.slice(e);
      setBlocks((prev) =>
        prev.map((b) => (b.id === bubble.id ? { ...b, text: next } : b))
      );
      setBubble(null);
      // Re-select the inner text after the value updates.
      const ns = s + before.length;
      const ne = ns + selected.length + extra;
      requestAnimationFrame(() => {
        const el = refs.current[bubble.id];
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(ns, ne);
          } catch {
            /* ignore */
          }
        }
      });
    },
    [bubble]
  );

  // --- autosave ---
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => onChangeRef.current?.(serialize(blocks)), 500);
    return () => clearTimeout(t);
  }, [blocks]);

  // --- apply pending focus after a structural change ---
  useEffect(() => {
    if (!pendingFocus) return;
    const el = refs.current[pendingFocus.id];
    if (el) {
      el.focus();
      const pos = pendingFocus.pos === "end" ? el.value.length : pendingFocus.pos;
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      });
    }
    setPendingFocus(null);
  }, [pendingFocus, blocks]);

  const focusBlock = useCallback((id: string, pos: number | "end" = "end") => {
    setFocusedId(id);
    setPendingFocus({ id, pos });
  }, []);

  const updateText = useCallback((id: string, text: string) => {
    const cur = blocksRef.current;
    const block = cur.find((b) => b.id === id);
    if (!block) return;

    // Slash menu: open while a paragraph starts with "/". Side effects live
    // OUTSIDE setBlocks so they fire deterministically (StrictMode runs the
    // updater twice — side effects there get dropped/duplicated).
    // Slash works in any simple single-line text block (not code/table/math/
    // image/divider), matching Notion/Eden.
    const slashable =
      block.type === "paragraph" ||
      block.type === "h1" ||
      block.type === "h2" ||
      block.type === "h3" ||
      block.type === "bullet" ||
      block.type === "numbered" ||
      block.type === "quote" ||
      block.type === "checklist";
    if (slashable && text.startsWith("/")) {
      const el =
        refs.current[id] ||
        (typeof document !== "undefined"
          ? (document.activeElement as HTMLTextAreaElement | null)
          : null);
      const r = el?.getBoundingClientRect();
      setSlash({
        id,
        x: r ? r.left : 200,
        y: r ? r.bottom + 4 : 200,
        query: text.slice(1),
      });
    } else {
      setSlash((s) => (s && s.id === id ? null : s));
    }

    // Markdown autoformat on paragraph blocks.
    if (block.type === "paragraph") {
      const af = detectAutoformat(text);
      if (af) {
        setSlash(null);
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  type: af.type,
                  text: af.text,
                  checked: af.type === "checklist" ? !!af.checked : undefined,
                }
              : b
          )
        );
        setPendingFocus({ id, pos: 0 });
        return;
      }
    }

    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
  }, []);

  const applySlashType = useCallback(
    (id: string, type: BlockType) => {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx < 0) return prev;
        const next = [...prev];
        if (type === "divider") {
          next[idx] = { ...next[idx], type: "divider", text: "" };
          // ensure an editable block follows the divider
          if (idx === next.length - 1) next.push(emptyBlock("paragraph"));
        } else if (type === "table") {
          next[idx] = {
            ...next[idx],
            type: "table",
            text: "| Column A | Column B |\n| --- | --- |\n| Cell | Cell |",
          };
        } else {
          next[idx] = { ...next[idx], type, text: "" };
        }
        return next;
      });
      setSlash(null);
      if (type !== "divider") setPendingFocus({ id, pos: 0 });
    },
    []
  );

  // --- undo / redo (coalesces rapid typing into one step) ---
  const history = useRef<{
    past: Block[][];
    future: Block[][];
    prev: Block[];
    suppress: boolean;
    lastPush: number;
  }>({ past: [], future: [], prev: blocks, suppress: false, lastPush: 0 });

  useEffect(() => {
    const u = history.current;
    if (u.suppress) {
      u.suppress = false;
      u.prev = blocks;
      return;
    }
    const now = Date.now();
    if (now - u.lastPush > 700) {
      u.past.push(u.prev);
      if (u.past.length > 100) u.past.shift();
    }
    u.lastPush = now;
    u.future = [];
    u.prev = blocks;
  }, [blocks]);

  const undo = useCallback(() => {
    const u = history.current;
    if (!u.past.length) return;
    u.future.push(u.prev);
    const prevState = u.past.pop()!;
    u.suppress = true;
    setBlocks(prevState);
  }, []);

  const redo = useCallback(() => {
    const u = history.current;
    if (!u.future.length) return;
    u.past.push(u.prev);
    const nextState = u.future.pop()!;
    u.suppress = true;
    setBlocks(nextState);
  }, []);

  const toggleChecked = useCallback((id: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b))
    );
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => {
      // Undo / redo.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // While the slash menu is open it owns arrows/enter/escape (use the ref so
      // a stale render closure can't let Enter split the block mid-selection).
      const s = slashRef.current;
      if (s && s.id === block.id) {
        if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
          e.preventDefault();
          return;
        }
      }

      const ta = e.currentTarget;
      const caret = ta.selectionStart ?? 0;
      const caretEnd = ta.selectionEnd ?? 0;

      const multiline =
        block.type === "code" || block.type === "math" || block.type === "table";

      // Image is a single-line input: Enter starts a fresh paragraph after it.
      if (e.key === "Enter" && block.type === "image") {
        e.preventDefault();
        const nb = emptyBlock("paragraph");
        setBlocks((prev) => {
          const idx = prev.findIndex((b) => b.id === block.id);
          const next = [...prev];
          next.splice(idx + 1, 0, nb);
          return next;
        });
        focusBlock(nb.id, 0);
        return;
      }

      // Code/math/table: Enter inserts a newline (default behaviour).
      if (e.key === "Enter" && !e.shiftKey && !multiline) {
        e.preventDefault();
        // Exit a list when pressing Enter on an empty item.
        if (isListLike(block.type) && block.text.trim() === "") {
          setBlocks((prev) =>
            prev.map((b) => (b.id === block.id ? { ...b, type: "paragraph" } : b))
          );
          return;
        }
        const left = block.text.slice(0, caret);
        const right = block.text.slice(caretEnd);
        const nb: Block = { ...emptyBlock(continuationType(block.type)), text: right };
        setBlocks((prev) => {
          const idx = prev.findIndex((b) => b.id === block.id);
          const next = [...prev];
          next[idx] = { ...next[idx], text: left };
          next.splice(idx + 1, 0, nb);
          return next;
        });
        focusBlock(nb.id, 0);
        return;
      }

      if (e.key === "Backspace" && caret === 0 && caretEnd === 0) {
        // Convert a styled block back to a paragraph first.
        if (block.type !== "paragraph") {
          e.preventDefault();
          setBlocks((prev) =>
            prev.map((b) => (b.id === block.id ? { ...b, type: "paragraph" } : b))
          );
          return;
        }
        // Merge into the previous block.
        setBlocks((prev) => {
          const idx = prev.findIndex((b) => b.id === block.id);
          if (idx <= 0) return prev;
          const prevBlock = prev[idx - 1];
          if (prevBlock.type === "divider") {
            // delete the divider instead
            const next = prev.filter((_, i) => i !== idx - 1);
            return next;
          }
          e.preventDefault();
          const junction = prevBlock.text.length;
          const merged: Block = { ...prevBlock, text: prevBlock.text + block.text };
          const next = [...prev];
          next[idx - 1] = merged;
          next.splice(idx, 1);
          setPendingFocus({ id: prevBlock.id, pos: junction });
          return next;
        });
        return;
      }

      // Arrow navigation across blocks at boundaries.
      if (e.key === "ArrowUp" && caret === 0) {
        const idx = blocks.findIndex((b) => b.id === block.id);
        if (idx > 0) {
          e.preventDefault();
          focusBlock(blocks[idx - 1].id, "end");
        }
      } else if (e.key === "ArrowDown" && caret === block.text.length) {
        const idx = blocks.findIndex((b) => b.id === block.id);
        if (idx < blocks.length - 1) {
          e.preventDefault();
          focusBlock(blocks[idx + 1].id, 0);
        }
      }
    },
    [slash, blocks, focusBlock]
  );

  // Click on empty space below the last block → focus/extend the document.
  const onSurfaceClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return;
      const last = blocks[blocks.length - 1];
      if (last && last.type !== "divider") focusBlock(last.id, "end");
      else {
        const nb = emptyBlock("paragraph");
        setBlocks((prev) => [...prev, nb]);
        focusBlock(nb.id, 0);
      }
    },
    [blocks, focusBlock]
  );

  return (
    <div className={className}>
      <div
        className="space-y-1"
        onClick={onSurfaceClick}
        onBlur={(e) => {
          // When focus leaves the block list entirely, deselect so every block
          // renders its final form (e.g. KaTeX math, rendered markdown).
          const next = e.relatedTarget as Node | null;
          if (slash) return; // keep focus while the slash menu is interacting
          if (!next || !e.currentTarget.contains(next)) {
            setTimeout(() => setFocusedId(null), 0);
          }
        }}
      >
        {blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            focused={focusedId === block.id}
            onFocus={() => setFocusedId(block.id)}
            onChange={(text) => updateText(block.id, text)}
            onToggle={() => toggleChecked(block.id)}
            onKeyDown={(e) => onKeyDown(e, block)}
            registerRef={(el) => {
              refs.current[block.id] = el;
            }}
          />
        ))}
      </div>

      <SlashMenu
        open={!!slash}
        x={slash?.x ?? 0}
        y={slash?.y ?? 0}
        query={slash?.query ?? ""}
        onPick={(type) => {
          const s = slashRef.current;
          if (s) applySlashType(s.id, type);
        }}
        onClose={() => setSlash(null)}
      />

      <BubbleMenu
        open={!!bubble && !slash}
        x={bubble?.x ?? 0}
        y={bubble?.y ?? 0}
        onWrap={wrapSelection}
      />
    </div>
  );
}
