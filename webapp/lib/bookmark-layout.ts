import type { BookmarkItem } from "./types-bookmarks";

const COL_W = 340;
const ROW_H = 420;
const GAP = 24;

/**
 * Arrange bookmarks on the canvas: cluster by primary tag, grid within cluster.
 */
export function autoLayoutBookmarks(
  items: BookmarkItem[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const byTag = new Map<string, BookmarkItem[]>();
  for (const item of items) {
    const key = item.tags[0] || "untagged";
    const list = byTag.get(key) || [];
    list.push(item);
    byTag.set(key, list);
  }

  const tagOrder = [...byTag.keys()].sort();
  let clusterX = 0;

  for (const tag of tagOrder) {
    const group = byTag.get(tag) || [];
    const cols = 2;
    group.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(item.id, {
        x: clusterX + col * (COL_W + GAP),
        y: row * (ROW_H + GAP),
      });
    });
    clusterX += cols * (COL_W + GAP) + 80;
  }

  return positions;
}
