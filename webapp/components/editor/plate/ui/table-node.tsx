"use client";

/**
 * Minimal, self-contained table node components (Plate). No border/color
 * dropdown toolbars (those pull Radix) — just clean, editable tables that
 * round-trip through Markdown (GFM pipe tables).
 */
import { PlateElement, type PlateElementProps } from "platejs/react";
import { cn } from "@/lib/utils";

export function TableElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} className="py-2">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <tbody className="min-w-full">{props.children}</tbody>
        </table>
      </div>
    </PlateElement>
  );
}

export function TableRowElement(props: PlateElementProps) {
  return <PlateElement as="tr" {...props} />;
}

export function TableCellElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="td"
      {...props}
      className={cn(
        "border border-border px-3 py-1.5 align-top",
        "min-w-[2rem]"
      )}
    />
  );
}

export function TableCellHeaderElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="th"
      {...props}
      className="border border-border bg-muted/50 px-3 py-1.5 text-left align-top font-semibold"
    />
  );
}
