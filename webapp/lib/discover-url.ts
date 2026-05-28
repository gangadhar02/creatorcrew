/** Shared URL helpers for Discover / creator filter state. */

export const DISCOVER_RANGES = [
  { id: "all", label: "All time" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 3 months" },
  { id: "6mo", label: "Last 6 months" },
  { id: "1y", label: "Last 1 year" },
] as const;

export const DISCOVER_OUTLIER_THRESHOLDS = [
  { id: "0", label: "Any" },
  { id: "2", label: "2× or more" },
  { id: "5", label: "5× or more" },
  { id: "10", label: "10× or more" },
  { id: "20", label: "20× or more" },
] as const;

export const DISCOVER_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "substack", label: "Substack" },
  { id: "x", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

export const DISCOVER_SORTS = [
  { id: "outlier", label: "Top outlier" },
  { id: "recent", label: "Recent" },
  { id: "top_liked", label: "Top liked" },
  { id: "top_viewed", label: "Top viewed" },
] as const;

/** Eden defaults when params are absent from the URL. */
export const DEFAULT_DISCOVER_RANGE = "90d";
export const DEFAULT_MIN_OUTLIER = "10";
export const DEFAULT_DISCOVER_SORT = "outlier";

export function rangeCutoff(range: string): string | null {
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

function shouldOmitParam(key: string, value: string): boolean {
  if (key === "range" && value === DEFAULT_DISCOVER_RANGE) return true;
  if (key === "min_outlier" && value === DEFAULT_MIN_OUTLIER) return true;
  if (key === "platform" && (value === "all" || value === "")) return true;
  if (key === "sort" && value === DEFAULT_DISCOVER_SORT) return true;
  if (key === "pillar" && (value === "all" || value === "")) return true;
  if (key === "hide_seen" && value !== "1") return true;
  if (key === "hide_images" && value !== "1") return true;
  if (key === "q" && value === "") return true;
  if (key === "type" && (value === "all" || value === "")) return true;
  return false;
}

/** Build a filter URL, preserving unrelated params and omitting Eden defaults. */
export function buildFilterHref(
  basePath: string,
  sp: Record<string, string | undefined>,
  patch: Record<string, string | null | undefined>
): string {
  const merged: Record<string, string | undefined> = { ...sp };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) delete merged[k];
    else merged[k] = v;
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (!v || shouldOmitParam(k, v)) continue;
    params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function discoverSummary(sp: Record<string, string | undefined>): string {
  const platform = sp.platform || "all";
  const range = sp.range || DEFAULT_DISCOVER_RANGE;
  const minOutlier = sp.min_outlier ?? DEFAULT_MIN_OUTLIER;

  const platformLabel =
    platform === "all"
      ? "All"
      : DISCOVER_PLATFORMS.find((p) => p.id === platform)?.label || platform;
  const rangeLabel =
    DISCOVER_RANGES.find((r) => r.id === range)?.label || "All time";
  const outlierLabel =
    DISCOVER_OUTLIER_THRESHOLDS.find((o) => o.id === minOutlier)?.label || "Any";

  return [platformLabel, rangeLabel, `${outlierLabel} outlier`].join(" · ");
}

export function isDiscoverDirty(sp: Record<string, string | undefined>): boolean {
  const range = sp.range || DEFAULT_DISCOVER_RANGE;
  const platform = sp.platform || "all";
  const minOutlier = sp.min_outlier ?? DEFAULT_MIN_OUTLIER;
  const sort = sp.sort || DEFAULT_DISCOVER_SORT;

  return (
    range !== DEFAULT_DISCOVER_RANGE ||
    platform !== "all" ||
    minOutlier !== DEFAULT_MIN_OUTLIER ||
    sort !== DEFAULT_DISCOVER_SORT ||
    sp.hide_seen === "1" ||
    sp.hide_images === "1" ||
    Boolean(sp.pillar && sp.pillar !== "all") ||
    Boolean(sp.q)
  );
}
