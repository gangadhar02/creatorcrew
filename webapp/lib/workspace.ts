/**
 * Session-keyed workspace context.
 *
 * Each authenticated user owns exactly one workspace. On every request we:
 *   1. Look up the user's workspace by `owner_user_id = auth.uid()`.
 *   2. If none, claim a legacy single-tenant workspace whose `owner_email`
 *      matches the user's email (this is how `sgangadhar.exe@gmail.com`
 *      adopts the pre-auth data on first sign-in).
 *   3. Otherwise, create a fresh empty workspace + seed onboarding rows.
 *
 * All DB writes here use the service-role client (`getSupabase()`), so
 * they bypass RLS. The session check happens before any writes — if no
 * user, the function returns the empty shell and the layout doesn't
 * render the sidebar (proxy.ts will have redirected to /login anyway).
 */
import { cache } from "react";
import { getSupabase } from "./supabase";
import { getSupabaseServerClient } from "./supabase-server";

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceEmail: string;
  userId: string | null;
  userEmail: string | null;
  /** Display name the user chose in onboarding (user_metadata.display_name). */
  userName: string | null;
  /** True once the user has finished (or skipped) the first-run onboarding flow. */
  onboarded: boolean;
  onboardingCompleted: number;
  onboardingTotal: number;
  onboarding: { task_key: string; completed_at: string | null }[];
};

const TOTAL_TASKS = 4;
const ONBOARDING_TASK_KEYS = [
  "build_voice",
  "create_board",
  "use_boost",
  "add_creator_to_list",
] as const;

const EMPTY_CONTEXT: WorkspaceContext = {
  workspaceId: "",
  workspaceName: "CreatorCrew",
  workspaceEmail: "",
  userId: null,
  userEmail: null,
  userName: null,
  onboarded: false,
  onboardingCompleted: 0,
  onboardingTotal: TOTAL_TASKS,
  onboarding: [],
};

// Memoized per-request so we don't run the same query 6 times when
// multiple server components each call getWorkspaceContext().
export const getWorkspaceContext = cache(
  async (): Promise<WorkspaceContext> => {
    const authClient = await getSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return EMPTY_CONTEXT;
    }

    const sb = getSupabase();
    const userEmail = user.email || null;
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const userName =
      typeof meta.display_name === "string" && meta.display_name.trim()
        ? meta.display_name
        : null;
    const onboarded = meta.onboarded === true;

    // 1. Already-claimed workspace?
    const ownedRes = await sb
      .from("workspaces")
      .select("id, name, owner_email")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();

    let ws = ownedRes.data as
      | { id: string; name: string; owner_email: string | null }
      | null;

    // 2. Unclaimed workspace with matching owner_email? Claim it.
    if (!ws && userEmail) {
      const claimRes = await sb
        .from("workspaces")
        .select("id, name, owner_email")
        .is("owner_user_id", null)
        .eq("owner_email", userEmail)
        .limit(1)
        .maybeSingle();
      const candidate = claimRes.data as
        | { id: string; name: string; owner_email: string | null }
        | null;
      if (candidate) {
        const upd = await sb
          .from("workspaces")
          .update({
            owner_user_id: user.id,
            owner_email: userEmail,
          })
          .eq("id", candidate.id)
          .select("id, name, owner_email")
          .single();
        ws = upd.data as
          | { id: string; name: string; owner_email: string | null }
          | null;
      }
    }

    // 3. Bootstrap a fresh workspace for this user.
    if (!ws) {
      const displayName = (userEmail?.split("@")[0] || "you") + "'s workspace";
      const ins = await sb
        .from("workspaces")
        .insert({
          name: displayName,
          owner_user_id: user.id,
          owner_email: userEmail,
        })
        .select("id, name, owner_email")
        .single();
      ws = ins.data as
        | { id: string; name: string; owner_email: string | null }
        | null;

      if (ws) {
        // Seed onboarding rows so the Home checklist renders 0/4.
        await sb
          .from("onboarding_progress")
          .insert(
            ONBOARDING_TASK_KEYS.map((task_key) => ({
              workspace_id: ws!.id,
              task_key,
            }))
          )
          .select();
      }
    }

    if (!ws) {
      // Couldn't read or create — return empty shell rather than throwing.
      return { ...EMPTY_CONTEXT, userId: user.id, userEmail, userName, onboarded };
    }

    const obRes = await sb
      .from("onboarding_progress")
      .select("task_key, completed_at")
      .eq("workspace_id", ws.id);
    const onboarding =
      (obRes.data || []) as { task_key: string; completed_at: string | null }[];
    const completed = onboarding.filter((o) => o.completed_at).length;

    return {
      workspaceId: ws.id,
      workspaceName: ws.name,
      workspaceEmail: ws.owner_email || userEmail || "",
      userId: user.id,
      userEmail,
      userName,
      onboarded,
      onboardingCompleted: completed,
      onboardingTotal: TOTAL_TASKS,
      onboarding,
    };
  }
);
