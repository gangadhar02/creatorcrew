"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  Rocket,
  Sparkles,
  Briefcase,
  Heart,
  Layers,
  Brain,
  GraduationCap,
  Wrench,
  Palette,
  Workflow,
  TrendingUp,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Pillar = { id: string; name: string; color: string };

// Color tokens for active chip background
const COLOR_BG: Record<string, string> = {
  blue: "bg-sky-500 text-white",
  purple: "bg-purple-500 text-white",
  orange: "bg-orange-500 text-white",
  green: "bg-emerald-500 text-white",
  pink: "bg-pink-500 text-white",
  red: "bg-rose-500 text-white",
  yellow: "bg-amber-500 text-white",
  cyan: "bg-cyan-500 text-white",
  gray: "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900",
};

// Active dot color (when chip is not selected)
const COLOR_DOT: Record<string, string> = {
  blue: "bg-sky-400",
  purple: "bg-purple-400",
  orange: "bg-orange-400",
  green: "bg-emerald-400",
  pink: "bg-pink-400",
  red: "bg-rose-400",
  yellow: "bg-amber-400",
  cyan: "bg-cyan-400",
  gray: "bg-zinc-400",
};

function iconFor(name: string): React.ComponentType<{ className?: string }> {
  const n = name.toLowerCase();
  if (n.includes("productiv") || n.includes("process") || n.includes("workflow"))
    return Workflow;
  if (n.includes("self") || n.includes("growth")) return Sparkles;
  if (n.includes("business") || n.includes("marketing")) return Briefcase;
  if (n.includes("health") || n.includes("fitness")) return Heart;
  if (n.includes("content") || n.includes("creator") || n.includes("showcase"))
    return Layers;
  if (n.includes("psychology") || n.includes("mind")) return Brain;
  if (n.includes("teach") || n.includes("education") || n.includes("learn"))
    return GraduationCap;
  if (n.includes("tool")) return Wrench;
  if (n.includes("design") || n.includes("art")) return Palette;
  if (n.includes("trend") || n.includes("viral")) return TrendingUp;
  if (n.includes("launch") || n.includes("startup")) return Rocket;
  return Tag;
}

// Suggested pillars users can add quickly via the dialog (seed bank).
const SUGGESTED_PILLARS: { name: string; color: string }[] = [
  { name: "Productivity", color: "purple" },
  { name: "Self-improvement", color: "pink" },
  { name: "Business", color: "green" },
  { name: "Health & fitness", color: "red" },
  { name: "Content creation", color: "orange" },
  { name: "Psychology", color: "blue" },
  { name: "AI agents", color: "cyan" },
  { name: "Marketing", color: "yellow" },
  { name: "Storytelling", color: "purple" },
  { name: "Design", color: "pink" },
  { name: "Startups", color: "green" },
  { name: "Mindset", color: "blue" },
];

export default function PillarChips({
  pillars,
  activeId,
  basePath,
  sp,
}: {
  pillars: Pillar[];
  activeId: string;
  basePath: string;
  sp: Record<string, string | undefined>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState<string>("gray");
  const [submitting, setSubmitting] = useState(false);

  function hrefFor(pid: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "pillar") params.set(k, v);
    }
    if (pid !== "all") params.set("pillar", pid);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const existingNames = new Set(pillars.map((p) => p.name.toLowerCase()));

  async function createPillar(name: string, color: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/pillars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        setDialogOpen(false);
        setCustomName("");
        setCustomColor("gray");
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefFor("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            activeId === "all"
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </Link>
        {pillars.map((p) => {
          const active = activeId === p.id;
          const Icon = iconFor(p.name);
          const bg = COLOR_BG[p.color] || COLOR_BG.gray;
          return (
            <Link
              key={p.id}
              href={hrefFor(p.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? `border-transparent ${bg}`
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {active ? (
                <Icon className="h-3 w-3" />
              ) : (
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    COLOR_DOT[p.color] || COLOR_DOT.gray
                  )}
                />
              )}
              {p.name}
            </Link>
          );
        })}
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/60"
        >
          <Plus className="h-3 w-3" /> Add pillar
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a pillar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Suggested
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PILLARS.map((s) => {
                  const exists = existingNames.has(s.name.toLowerCase());
                  const Icon = iconFor(s.name);
                  return (
                    <button
                      key={s.name}
                      disabled={exists || submitting}
                      onClick={() => createPillar(s.name, s.color)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                        exists
                          ? "border-border bg-muted text-muted-foreground line-through cursor-not-allowed"
                          : "border-border hover:border-primary/60 hover:bg-primary/5"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Custom
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customName.trim()) createPillar(customName.trim(), customColor);
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Pillar name"
                  className="flex-1"
                />
                <select
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  {Object.keys(COLOR_DOT).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!customName.trim() || submitting}
                >
                  Add
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
