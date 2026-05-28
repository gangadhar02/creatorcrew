"use client";

import { Children, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function useColumnCount(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      if (w >= 1536) setCount(5);
      else if (w >= 1280) setCount(4);
      else if (w >= 1024) setCount(3);
      else if (w >= 640) setCount(2);
      else setCount(1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return count;
}

/**
 * Eden-style masonry: distribute cards across columns (round-robin) so tall
 * portrait posts don't stack in one column and leave huge gaps in others.
 * CSS `columns` + break-inside-avoid causes those mid-column holes.
 */
export default function MasonryGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(containerRef);
  const items = Children.toArray(children);

  const columns = useMemo(() => {
    const cols: React.ReactNode[][] = Array.from({ length: columnCount }, () => []);
    items.forEach((item, i) => {
      cols[i % columnCount].push(item);
    });
    return cols;
  }, [items, columnCount]);

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <div className="flex items-start gap-3">
        {columns.map((col, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-3">
            {col}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MasonryItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}
