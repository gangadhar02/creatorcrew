/**
 * /workspace — Phase 11 multi-pane view.
 *
 * URL drives pane state: ?panes=post:abc,chat:def,document:ghi&active=1
 * - Up to 3 panes side-by-side, each independently scrollable.
 * - Option+1/2/3 focuses pane N; Option+W closes the active pane.
 * - Cards in /discover, /boards, /chat have an "Open in pane" button that
 *   pushes a new pane onto this URL.
 */
import { parsePanes, clampActive } from "@/lib/panes";
import { loadPaneData } from "@/lib/pane-data";
import PaneShell from "@/components/PaneShell";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ panes?: string; active?: string }>;
}) {
  const sp = await searchParams;
  const panes = parsePanes(sp.panes);
  const active = clampActive(Number(sp.active || "0"), Math.max(panes.length, 1));

  const loaded = await Promise.all(panes.map((p) => loadPaneData(p)));

  return <PaneShell initialPanes={loaded} initialActive={active} />;
}
