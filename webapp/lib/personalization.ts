/**
 * Personalization: build a workspace profile embedding from the last N
 * dwell/impression signals (weighted by dwell_ms) and use it as an ANN query
 * vector. Becomes "eligible" once the workspace has accumulated ≥ 8 signals.
 */
import { getSupabase } from "./supabase";

const SIGNAL_THRESHOLD = 8;
const PROFILE_HORIZON = 50;

export type PersonalizationDiag = {
  enabled: boolean;
  eligible: boolean;
  reason: string;
  signalWeight: number;
  profileVectorDims: number;
  annPoolSize: number;
  annPoolMerged: number;
  threshold: number;
};

export async function countSignals(workspaceId: string): Promise<number> {
  const sb = getSupabase();
  const { count } = await sb
    .from("post_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .in("event_type", ["dwell", "impression", "click", "save", "boost"]);
  return count || 0;
}

/**
 * Compute the workspace profile vector as a dwell-weighted mean of the last
 * `PROFILE_HORIZON` event embeddings.
 */
export async function buildProfileVector(
  workspaceId: string
): Promise<{ vector: number[] | null; sampled: number }> {
  const sb = getSupabase();
  const { data: evs } = await sb
    .from("post_events")
    .select("content_id, dwell_ms")
    .eq("workspace_id", workspaceId)
    .in("event_type", ["dwell", "impression"])
    .order("occurred_at", { ascending: false })
    .limit(PROFILE_HORIZON);
  const rows = (evs || []) as { content_id: string; dwell_ms: number | null }[];
  if (rows.length === 0) return { vector: null, sampled: 0 };
  const ids = rows.map((r) => r.content_id);
  const { data: posts } = await sb
    .from("creator_posts")
    .select("id, embedding")
    .in("id", ids);
  const byId = new Map<string, number[]>();
  for (const p of (posts || []) as { id: string; embedding: number[] | null }[]) {
    if (p.embedding) byId.set(p.id, p.embedding);
  }
  if (byId.size === 0) return { vector: null, sampled: 0 };

  const dims = byId.values().next().value!.length;
  const acc = new Float64Array(dims);
  let totalWeight = 0;
  for (const r of rows) {
    const emb = byId.get(r.content_id);
    if (!emb) continue;
    const w = Math.max(1, Math.log(1 + (r.dwell_ms || 1000)));
    totalWeight += w;
    for (let i = 0; i < dims; i++) acc[i] += emb[i] * w;
  }
  if (totalWeight === 0) return { vector: null, sampled: 0 };
  const out = new Array<number>(dims);
  for (let i = 0; i < dims; i++) out[i] = acc[i] / totalWeight;
  // L2 normalize so it pairs well with cosine distance.
  let sumSq = 0;
  for (const v of out) sumSq += v * v;
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dims; i++) out[i] /= norm;
  return { vector: out, sampled: byId.size };
}

export async function personalizationDiagnostics(
  workspaceId: string
): Promise<PersonalizationDiag> {
  const signals = await countSignals(workspaceId);
  const eligible = signals >= SIGNAL_THRESHOLD;
  return {
    enabled: true,
    eligible,
    reason: eligible ? "ready" : `need_${SIGNAL_THRESHOLD - signals}_more`,
    signalWeight: Math.min(1, signals / 30),
    profileVectorDims: 768,
    annPoolSize: 50,
    annPoolMerged: 0,
    threshold: SIGNAL_THRESHOLD,
  };
}
