"use client";

import { useCallback } from "react";
import MasonryGrid from "@/components/board/MasonryGrid";
import { COLUMN_WIDTH } from "@/components/canvas/types";
import BookmarkCard from "@/components/BookmarkCard";
import type { BookmarkItem } from "@/lib/types-bookmarks";

function estimateHeight(item: BookmarkItem): number {
  return item.thumbnail_url ? 380 : 200;
}

export default function BookmarkCanvasView({
  items,
  onUpdate,
  onDelete,
  onPasteUrl,
}: {
  items: BookmarkItem[];
  onUpdate: (id: string, patch: Partial<BookmarkItem>) => void;
  onDelete: (id: string) => void;
  onPasteUrl?: (url: string, point?: { x: number; y: number }) => void;
}) {
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!onPasteUrl) return;
      const url =
        e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text");
      if (url && /^https?:\/\//.test(url.trim())) {
        e.preventDefault();
        onPasteUrl(url.trim());
      }
    },
    [onPasteUrl]
  );

  return (
    <div
      className="subtle-scroll relative h-[calc(100vh-180px)] w-full overflow-y-auto"
      onDragOver={(e) => onPasteUrl && e.preventDefault()}
      onDrop={onDrop}
    >
      <MasonryGrid<BookmarkItem>
        items={items}
        estimateHeight={estimateHeight}
        renderItem={(item) => (
          <div data-card style={{ width: COLUMN_WIDTH }}>
            <BookmarkCard
              item={item}
              onUpdate={(patch) => onUpdate(item.id, patch)}
              onDelete={() => onDelete(item.id)}
            />
          </div>
        )}
      />
    </div>
  );
}
