/**
 * Pane state lives in the URL: `?panes=post:abc,board:def,chat:ghi&active=1`
 *
 * - Up to 3 panes (extra entries ignored).
 * - `active` is the index (0-based) of the currently focused pane.
 * - Entries are `<kind>:<id>` where kind ∈ {post,board,chat,document,creator,discover,saves,ideate}.
 *   The `discover`/`saves`/`ideate` kinds are special "no id" panes — just `discover:`.
 */

export type PaneKind =
  | "post"
  | "board"
  | "chat"
  | "document"
  | "creator"
  | "discover"
  | "saves"
  | "ideate"
  | "voice";

export type Pane = { kind: PaneKind; id: string };

export const MAX_PANES = 3;
const VALID_KINDS: PaneKind[] = [
  "post",
  "board",
  "chat",
  "document",
  "creator",
  "discover",
  "saves",
  "ideate",
  "voice",
];

export function parsePanes(panesParam: string | null | undefined): Pane[] {
  if (!panesParam) return [];
  return panesParam
    .split(",")
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg): Pane | null => {
      const idx = seg.indexOf(":");
      const kind = (idx === -1 ? seg : seg.slice(0, idx)) as PaneKind;
      const id = idx === -1 ? "" : seg.slice(idx + 1);
      if (!VALID_KINDS.includes(kind)) return null;
      return { kind, id };
    })
    .filter((p): p is Pane => p !== null)
    .slice(0, MAX_PANES);
}

export function serializePanes(panes: Pane[]): string {
  return panes
    .slice(0, MAX_PANES)
    .map((p) => `${p.kind}:${p.id}`)
    .join(",");
}

export function clampActive(active: number, paneCount: number): number {
  if (paneCount === 0) return 0;
  return Math.max(0, Math.min(active, paneCount - 1));
}

/**
 * Build a workspace URL that adds a new pane.
 * If `replaceActiveIndex` is provided, that pane slot is overwritten.
 * Otherwise the new pane is appended (or replaces the last pane if at max).
 */
export function buildPaneUrl(
  current: Pane[],
  next: Pane,
  opts?: { replaceActiveIndex?: number }
): string {
  let panes = [...current];
  if (
    opts?.replaceActiveIndex !== undefined &&
    opts.replaceActiveIndex >= 0 &&
    opts.replaceActiveIndex < panes.length
  ) {
    panes[opts.replaceActiveIndex] = next;
  } else if (panes.length < MAX_PANES) {
    panes.push(next);
  } else {
    panes = [...panes.slice(0, MAX_PANES - 1), next];
  }
  return `/workspace?panes=${encodeURIComponent(serializePanes(panes))}&active=${panes.length - 1}`;
}

/**
 * Shorthand for "open this entity in a new workspace tab" used by Open-in-pane
 * buttons. If the user is already in /workspace, the caller should use the
 * router to merge with existing panes instead.
 */
export function openInWorkspaceUrl(pane: Pane): string {
  return `/workspace?panes=${encodeURIComponent(serializePanes([pane]))}&active=0`;
}
