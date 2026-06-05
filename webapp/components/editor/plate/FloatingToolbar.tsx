"use client";

/**
 * Selection (bubble) toolbar — appears above a text selection with quick
 * formatting marks, like Notion/Potion. Built on Plate's floating positioning
 * hooks; styled self-contained (no base-ui primitives).
 */
import { flip, offset, useFloatingToolbar, useFloatingToolbarState } from "@platejs/floating";
import { KEYS } from "platejs";
import { useEditorId, useEditorRef, useEventEditorValue } from "platejs/react";
import { Bold, Italic, Underline, Strikethrough, Code } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FloatingToolbar() {
  const editor = useEditorRef();
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue("focus");

  const state = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    floatingOptions: {
      middleware: [
        offset(10),
        flip({
          fallbackPlacements: ["top-start", "top-end", "bottom-start", "bottom-end"],
          padding: 12,
        }),
      ],
      placement: "top",
    },
  });

  const { clickOutsideRef, hidden, props: rootProps, ref } = useFloatingToolbar(state);
  if (hidden) return null;

  const btn =
    "grid h-7 w-7 place-items-center rounded text-popover-foreground/80 hover:bg-accent hover:text-foreground";

  const marks: { key: string; icon: typeof Bold; title: string }[] = [
    { key: KEYS.bold, icon: Bold, title: "Bold" },
    { key: KEYS.italic, icon: Italic, title: "Italic" },
    { key: KEYS.underline, icon: Underline, title: "Underline" },
    { key: KEYS.strikethrough, icon: Strikethrough, title: "Strikethrough" },
    { key: KEYS.code, icon: Code, title: "Inline code" },
  ];

  return (
    <div ref={clickOutsideRef}>
      <div
        ref={ref}
        {...rootProps}
        className={cn(
          "absolute z-50 flex items-center gap-0.5 rounded-lg border border-border/70 bg-popover p-1 shadow-md print:hidden"
        )}
      >
        {marks.map(({ key, icon: Icon, title }) => (
          <button
            key={key}
            type="button"
            title={title}
            className={btn}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.tf.toggleMark(key);
            }}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
