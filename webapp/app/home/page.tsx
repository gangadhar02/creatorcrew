import Link from "next/link";
import {
  Sparkles,
  Check,
  Circle,
  ArrowRight,
  MessageSquare,
  LayoutGrid,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  logWorkspaceVisit,
  getWorkspaceActivity,
} from "@/lib/activity";
import { cn } from "@/lib/utils";
import type { SyncRun } from "@/lib/types";
import { Card } from "@/components/ui/card";
import ChecklistBuildVoiceButton from "@/components/ChecklistBuildVoiceButton";
import HomeFollowingFeed from "@/components/HomeFollowingFeed";
import StreakTracker from "@/components/StreakTracker";

export const dynamic = "force-dynamic";

const HEADLINES: string[] = [
  "Where do we start today?",
  "Pick your next move.",
  "Time to make something.",
  "What are we shipping today?",
  "What's on your mind?",
  "Welcome back.",
  "Let's make today productive.",
];

function pickHeadline(seed: number): string {
  return HEADLINES[seed % HEADLINES.length];
}

type ChecklistItem = {
  key: string;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
};

const CHECKLIST: ChecklistItem[] = [
  {
    key: "build_voice",
    title: "Build your voice",
    description:
      "Train CreatorCrew on your style so suggestions sound like you, not generic AI.",
    buttonLabel: "Build voice",
    href: "/voice",
  },
  {
    key: "create_board",
    title: "Create your first board",
    description:
      "Boards group related items so you can find them later. Try starting from a template.",
    buttonLabel: "New board",
    href: "/boards",
  },
  {
    key: "use_boost",
    title: "Use a boost",
    description:
      "Click the lightning icon on a post to reverse-engineer it and get variations fast.",
    buttonLabel: "Open Discover",
    href: "/discover",
  },
  {
    key: "add_creator_to_list",
    title: "Add creators to a list",
    description:
      "Curate creators you want to keep seeing so your feed stays focused.",
    buttonLabel: "Open Creators",
    href: "/creators",
  },
];

/** Relative time like "5h ago", "Yesterday", "3d ago" for recent lists. */
function fmtRelative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "–";
  // Fixed en-US format avoids SSR/client locale hydration mismatches.
  return new Date(iso).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

/** UTC day index — stable for the whole calendar day on server and client. */
function utcDayBucket(): number {
  const d = new Date();
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) /
      (1000 * 60 * 60 * 24)
  );
}

export default async function Dashboard() {
  const ws = await getWorkspaceContext();
  const sb = getSupabase();

  const [savesRes, ideasRes, runsRes] = await Promise.all([
    sb.from("saves").select("status").eq("workspace_id", ws.workspaceId),
    sb
      .from("content_ideas")
      .select("status")
      .eq("workspace_id", ws.workspaceId),
    sb
      .from("sync_runs")
      .select("*")
      .eq("workspace_id", ws.workspaceId)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  const totalSaves = (savesRes.data || []).length;
  const totalIdeas = (ideasRes.data || []).length;
  const runs = (runsRes.data || []) as SyncRun[];

  const completedKeys = new Set(
    ws.onboarding.filter((o) => o.completed_at).map((o) => o.task_key)
  );
  // Mostly rotates daily so the home headline feels alive without a refresh churn.
  const headline = pickHeadline(utcDayBucket() + ws.onboardingCompleted);
  const pct = (ws.onboardingCompleted / ws.onboardingTotal) * 100;
  // Once every onboarding task is done, drop the "Getting started" checklist
  // from the home page (like Eden) so it stops nagging completed users.
  const showOnboarding = ws.onboardingCompleted < ws.onboardingTotal;

  // My-lists section data
  const listsRes = ws.workspaceId
    ? await sb
        .from("creator_lists")
        .select("id, name, color")
        .eq("workspace_id", ws.workspaceId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] };
  const lists =
    (listsRes.data || []) as { id: string; name: string; color: string }[];

  // Recent boards + chats + the activity heatmap. Logging the visit first means
  // today shows up in the streak immediately.
  await logWorkspaceVisit(ws.workspaceId);
  const [boardsRes, chatsRes, activity] = await Promise.all([
    ws.workspaceId
      ? sb
          .from("boards")
          .select("id, name, icon, updated_at")
          .eq("workspace_id", ws.workspaceId)
          .eq("kind", "board")
          .order("updated_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    ws.workspaceId
      ? sb
          .from("chats")
          .select("id, title, updated_at")
          .eq("workspace_id", ws.workspaceId)
          .order("updated_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    getWorkspaceActivity(ws.workspaceId),
  ]);
  const recentBoards = (boardsRes.data || []) as {
    id: string;
    name: string;
    icon: string | null;
    updated_at: string;
  }[];
  const recentChats = (chatsRes.data || []) as {
    id: string;
    title: string;
    updated_at: string;
  }[];

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-center pt-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          <h1 className="text-3xl font-semibold tracking-tight">{headline}</h1>
        </div>
      </header>

      {/* Getting Started checklist (hidden once all tasks are complete) */}
      {showOnboarding && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Getting started</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                {ws.onboardingCompleted} / {ws.onboardingTotal}
              </span>
              <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {CHECKLIST.map((task) => {
              const done = completedKeys.has(task.key);
              return (
                <Card
                  key={task.key}
                  className={cn(
                    "flex flex-row items-center gap-4 p-4 card-hover",
                    done ? "opacity-60" : "hover:border-primary/40"
                  )}
                >
                  <div
                    className={cn(
                      "h-6 w-6 shrink-0 rounded-full border grid place-items-center transition-colors",
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border"
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      <Circle className="h-2 w-2 fill-muted-foreground text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        done && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {task.description}
                    </div>
                  </div>
                  {task.key === "build_voice" ? (
                    <ChecklistBuildVoiceButton
                      label={task.buttonLabel}
                      done={done}
                    />
                  ) : (
                    <Link
                      href={task.href}
                      className={cn(
                        "group shrink-0 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        done
                          ? "border bg-card text-muted-foreground"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {task.buttonLabel}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent items (boards) + Recent chats */}
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent items</h2>
            <Link
              href="/boards"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              All boards →
            </Link>
          </div>
          {recentBoards.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/50 px-3 py-4 text-xs text-muted-foreground">
              No boards yet. Create one to collect ideas and content.
            </p>
          ) : (
            <div className="space-y-0.5">
              {recentBoards.map((b) => (
                <Link
                  key={b.id}
                  href={`/boards/${b.id}`}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/60"
                >
                  <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {b.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtRelative(b.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent chats</h2>
            <Link
              href="/chat"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open chat →
            </Link>
          </div>
          {recentChats.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/50 px-3 py-4 text-xs text-muted-foreground">
              No chats yet. Start one to draft, research, or reverse-engineer.
            </p>
          ) : (
            <div className="space-y-0.5">
              {recentChats.map((c) => (
                <Link
                  key={c.id}
                  href={`/chats/${c.id}`}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/60"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.title || "Untitled chat"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtRelative(c.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <StreakTracker
        activeDays={activity.activeDays}
        streak={activity.streak}
      />

      <HomeFollowingFeed lists={lists} />

      {/* Stats */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">At a glance</h2>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard label="Saves" value={totalSaves} href="/saves" />
          <StatCard label="Content Ideas" value={totalIdeas} href="/ideas" />
          <StatCard
            label="Last sync"
            value={runs[0] ? fmtDate(runs[0].started_at) : "–"}
            href="/saves"
            small
          />
          <StatCard label="Sync runs" value={runs.length} href="/saves" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  small,
}: {
  label: string;
  value: string | number;
  href: string;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border bg-card p-3 card-hover hover:border-primary/40"
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-semibold tabular-nums",
          small ? "text-sm" : "text-2xl"
        )}
      >
        {value}
      </div>
    </Link>
  );
}
