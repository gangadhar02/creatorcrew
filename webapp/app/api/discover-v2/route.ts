/**
 * GET /api/discover-v2 — hybrid keyword+vector Discover.
 * Mirrors Eden's response shape with `content` + `feedDiagnostics`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { discover } from "@/lib/discover-engine";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rangeCutoff(range: string): string | null {
  const days: Record<string, number> = {
    "30d": 30,
    "90d": 90,
    "6mo": 180,
    "1y": 365,
  };
  if (!days[range]) return null;
  const d = new Date();
  d.setDate(d.getDate() - days[range]);
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ content: [], feedDiagnostics: null });
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q") || "";
  const platform = sp.get("platform");
  const platforms =
    platform && platform !== "all"
      ? platform.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
  const taxonomyParam = sp.get("taxonomy");
  const pillarTaxonomyIds =
    taxonomyParam && taxonomyParam !== "all"
      ? taxonomyParam.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
  const minOutlier = sp.get("min_outlier")
    ? parseFloat(sp.get("min_outlier")!)
    : 10;
  const range = sp.get("range") || "90d";
  const since = rangeCutoff(range) || undefined;
  const limit = Math.min(Number(sp.get("limit") || "60"), 200);

  const result = await discover({
    q,
    platforms,
    pillarTaxonomyIds,
    minOutlier,
    since,
    workspaceId: ws.workspaceId,
    limit,
  });
  return NextResponse.json(result);
}
