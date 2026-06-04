/**
 * Workspace activity streak (home-page GitHub-style heatmap).
 *
 * Any visit to the app home upserts today's row into `workspace_activity`
 * (one row per workspace per UTC calendar day). The heatmap + current streak
 * are derived from the last few months of rows.
 *
 * Dates are UTC `YYYY-MM-DD` strings so server render and stored values agree
 * regardless of locale.
 */
import { getSupabase } from "./supabase";

/** UTC `YYYY-MM-DD` for a given Date (defaults to now). */
export function utcDayString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Add `n` days (can be negative) to a UTC `YYYY-MM-DD` string. */
export function shiftDay(day: string, n: number): string {
  const d = new Date(day + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return utcDayString(d);
}

/** Record today's visit for this workspace. Best-effort; never throws. */
export async function logWorkspaceVisit(workspaceId: string): Promise<void> {
  if (!workspaceId) return;
  try {
    const sb = getSupabase();
    await sb
      .from("workspace_activity")
      .upsert(
        { workspace_id: workspaceId, day: utcDayString() },
        { onConflict: "workspace_id,day" }
      );
  } catch {
    // table may not exist yet (pre-migration 029) — degrade silently.
  }
}

export type WorkspaceActivity = {
  /** Set of active UTC day strings within the lookback window. */
  activeDays: Set<string>;
  /** Consecutive days of activity ending today (or yesterday). */
  streak: number;
};

/**
 * Fetch the active days within the last `days` and compute the current streak.
 * Never throws — returns an empty result if the table is missing.
 */
export async function getWorkspaceActivity(
  workspaceId: string,
  days = 140
): Promise<WorkspaceActivity> {
  const empty: WorkspaceActivity = { activeDays: new Set(), streak: 0 };
  if (!workspaceId) return empty;
  try {
    const sb = getSupabase();
    const since = shiftDay(utcDayString(), -days);
    const { data } = await sb
      .from("workspace_activity")
      .select("day")
      .eq("workspace_id", workspaceId)
      .gte("day", since)
      .order("day", { ascending: false });

    const activeDays = new Set(
      (data || []).map((r) => (r as { day: string }).day)
    );

    // Streak: walk back from today while each day is present. Tolerate a
    // not-yet-logged today by also accepting a streak that ends yesterday.
    const today = utcDayString();
    let cursor = activeDays.has(today) ? today : shiftDay(today, -1);
    let streak = 0;
    while (activeDays.has(cursor)) {
      streak += 1;
      cursor = shiftDay(cursor, -1);
    }

    return { activeDays, streak };
  } catch {
    return empty;
  }
}
