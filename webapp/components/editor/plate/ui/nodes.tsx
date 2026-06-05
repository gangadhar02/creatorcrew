"use client";

/**
 * Self-contained Plate node/leaf components (vendored & adapted from Plate's
 * open-source registry). These intentionally avoid our base-ui `components/ui`
 * primitives so the Plate editor subsystem doesn't collide with the app's
 * base-ui shadcn variant.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  PlateElement,
  PlateLeaf,
  useReadOnly,
  type PlateElementProps,
  type PlateLeafProps,
  type RenderNodeWrapper,
} from "platejs/react";
import { isOrderedList } from "@platejs/list";
import { useTodoListElement, useTodoListElementState } from "@platejs/list/react";
import type { TListElement } from "platejs";
import { cn } from "@/lib/utils";

// ---- Blocks ----
const headingVariants = cva("relative mb-1", {
  variants: {
    variant: {
      h1: "mt-8 pb-1 text-3xl font-bold tracking-tight",
      h2: "mt-6 pb-px text-2xl font-semibold tracking-tight",
      h3: "mt-5 pb-px text-xl font-semibold tracking-tight",
    },
  },
});

function HeadingElement({
  variant = "h1",
  ...props
}: PlateElementProps & VariantProps<typeof headingVariants>) {
  return (
    <PlateElement as={variant!} className={headingVariants({ variant })} {...props}>
      {props.children}
    </PlateElement>
  );
}
export function H1Element(props: PlateElementProps) {
  return <HeadingElement variant="h1" {...props} />;
}
export function H2Element(props: PlateElementProps) {
  return <HeadingElement variant="h2" {...props} />;
}
export function H3Element(props: PlateElementProps) {
  return <HeadingElement variant="h3" {...props} />;
}

export function ParagraphElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} className="m-0 px-0 py-1">
      {props.children}
    </PlateElement>
  );
}

export function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      className="my-1 border-l-2 border-border pl-4 text-muted-foreground italic"
      {...props}
    />
  );
}

export function HrElement(props: PlateElementProps) {
  return (
    <PlateElement {...props}>
      <div className="py-4" contentEditable={false}>
        <hr className="h-0.5 rounded-sm border-none bg-muted bg-clip-content" />
      </div>
      {props.children}
    </PlateElement>
  );
}

// Simplified code block (no language picker / no lowlight highlighting).
export function CodeBlockElement(props: PlateElementProps) {
  return (
    <PlateElement className="py-1" {...props}>
      <div className="rounded-md bg-muted/60">
        <pre className="overflow-x-auto p-4 font-mono text-sm leading-[normal] [tab-size:2]">
          <code>{props.children}</code>
        </pre>
      </div>
    </PlateElement>
  );
}
export function CodeLineElement(props: PlateElementProps) {
  return <PlateElement {...props} />;
}
// Syntax-highlight token leaf (lowlight sets a className like "hljs-keyword").
export function CodeSyntaxLeaf(props: PlateLeafProps) {
  const className = (props.leaf as { className?: string }).className;
  return <PlateLeaf className={className} {...props} />;
}

// ---- Marks ----
export function BoldLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="strong" {...props} />;
}
export function ItalicLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="em" {...props} />;
}
export function UnderlineLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="u" {...props} />;
}
export function StrikethroughLeaf(props: PlateLeafProps) {
  return <PlateLeaf as="s" {...props} />;
}
export function CodeLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      as="code"
      className="whitespace-pre-wrap rounded-md bg-muted px-[0.3em] py-[0.2em] font-mono text-[0.85em]"
      {...props}
    />
  );
}

// ---- Image (simplified void node; no resize/caption toolbar) ----
export function ImageElement(props: PlateElementProps) {
  const el = props.element as { url?: string; alt?: string };
  return (
    <PlateElement {...props} className="py-2">
      <figure contentEditable={false} className="m-0">
        {el.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={el.url}
            alt={el.alt || ""}
            className="max-w-full rounded-lg border border-border"
          />
        ) : null}
      </figure>
      {props.children}
    </PlateElement>
  );
}

// ---- Lists (indent-based, vendored from block-list with a plain checkbox) ----
export const BlockList: RenderNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;
  if (!isOrderedList(props.element)) return;
  return (childProps) => <List {...childProps} />;
};

function List(props: PlateElementProps & { lineBreakBadge?: React.ReactNode }) {
  const { listStart, listStyleType } = props.element as TListElement;
  const isTodo = listStyleType === "todo";
  const ListTag = isOrderedList(props.element) ? "ol" : "ul";

  return (
    <ListTag className="relative m-0 p-0" style={{ listStyleType }} start={listStart}>
      {isTodo && <TodoMarker {...props} />}
      {isTodo ? (
        <li
          className={cn(
            "list-none",
            (props.element.checked as boolean) &&
              "text-muted-foreground line-through"
          )}
        >
          {props.children}
          {props.lineBreakBadge}
        </li>
      ) : (
        <li>
          {props.children}
          {props.lineBreakBadge}
        </li>
      )}
    </ListTag>
  );
}

function TodoMarker(props: PlateElementProps) {
  const state = useTodoListElementState({ element: props.element });
  const { checkboxProps } = useTodoListElement(state);
  const readOnly = useReadOnly();
  return (
    <div contentEditable={false}>
      <input
        type="checkbox"
        checked={!!checkboxProps.checked}
        onChange={(e) => checkboxProps.onCheckedChange?.(e.target.checked)}
        disabled={readOnly}
        className={cn(
          "absolute -left-6 top-1.5 size-4 accent-foreground",
          readOnly && "pointer-events-none"
        )}
      />
    </div>
  );
}
