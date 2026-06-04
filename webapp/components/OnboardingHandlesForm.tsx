"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Platform = "instagram" | "youtube" | "substack";

type FieldState = {
  value: string;
  status: "idle" | "queued" | "ok" | "failed";
};

const PLATFORMS: { id: Platform; label: string; placeholder: string }[] = [
  { id: "instagram", label: "Instagram handle", placeholder: "@gregisenberg" },
  { id: "youtube", label: "YouTube channel", placeholder: "@MKBHD" },
  { id: "substack", label: "Substack publication", placeholder: "thewhitehouse" },
];

/**
 * Onboarding "Get a head start" screen. The user provides handles across
 * platforms; we kick off background ingest jobs for each, then redirect home.
 */
export default function OnboardingHandlesForm() {
  const router = useRouter();
  const [fields, setFields] = useState<Record<Platform, FieldState>>({
    instagram: { value: "", status: "idle" },
    youtube: { value: "", status: "idle" },
    substack: { value: "", status: "idle" },
  });
  const [submitting, setSubmitting] = useState(false);

  function update(id: Platform, patch: Partial<FieldState>) {
    setFields((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
  }

  async function submit() {
    setSubmitting(true);
    const jobs: Promise<void>[] = [];
    for (const p of PLATFORMS) {
      const v = fields[p.id].value.trim().replace(/^@/, "");
      if (!v) continue;
      update(p.id, { status: "queued" });
      jobs.push(
        (async () => {
          try {
            if (p.id === "instagram") {
              const r = await fetch("/api/profiles/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ handle: v }),
              });
              if (r.ok) update(p.id, { status: "ok" });
              else update(p.id, { status: "failed" });
            } else {
              const r = await fetch(`/api/ingest/${p.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ handle: v }),
              });
              if (r.ok) update(p.id, { status: "ok" });
              else update(p.id, { status: "failed" });
            }
          } catch {
            update(p.id, { status: "failed" });
          }
        })()
      );
    }
    await Promise.allSettled(jobs);
    toast.success("Scan kicked off");
    setSubmitting(false);
    router.push("/discover");
  }

  function skip() {
    router.push("/");
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Get a head start</h2>
        <p className="text-xs text-muted-foreground">
          Drop in handles for creators you want to follow. We&apos;ll ingest
          their recent posts so Discover has data on landing.
        </p>
      </div>
      <div className="space-y-3">
        {PLATFORMS.map((p) => (
          <div key={p.id} className="grid gap-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {p.label}
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={fields[p.id].value}
                onChange={(e) => update(p.id, { value: e.target.value })}
                placeholder={p.placeholder}
                disabled={submitting}
              />
              {fields[p.id].status === "queued" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {fields[p.id].status === "ok" && (
                <span className="text-[10px] text-emerald-500">queued</span>
              )}
              {fields[p.id].status === "failed" && (
                <span className="text-[10px] text-destructive">failed</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={skip}>
          Skip for now
        </Button>
        <Button onClick={submit} disabled={submitting}>
          Start scan
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
