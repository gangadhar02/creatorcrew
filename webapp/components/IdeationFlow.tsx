"use client";

import { useState } from "react";
import type { Save } from "@/lib/types";
import type { IdeaProposal } from "@/lib/ideate";
import MarkdownView from "./MarkdownView";
import VoicePicker from "./VoicePicker";

type Result = {
  save: Pick<Save, "id" | "author" | "type" | "url" | "collection_name">;
  proposal: IdeaProposal | null;
  error?: string;
};

type CardState =
  | { kind: "pending" }
  | { kind: "approving" }
  | { kind: "approved"; idea_id: string }
  | { kind: "skipping" }
  | { kind: "skipped" }
  | { kind: "error"; message: string };

export default function IdeationFlow({ saves }: { saves: Save[] }) {
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [error, setError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  async function runIdeation() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ideate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_id: voiceId }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results as Result[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function approve(r: Result) {
    if (!r.proposal) return;
    setCardStates((s) => ({ ...s, [r.save.id]: { kind: "approving" } }));
    try {
      const res = await fetch("/api/ideate/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ save_id: r.save.id, idea: r.proposal }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { idea_id: string };
      setCardStates((s) => ({
        ...s,
        [r.save.id]: { kind: "approved", idea_id: data.idea_id },
      }));
    } catch (e) {
      setCardStates((s) => ({
        ...s,
        [r.save.id]: { kind: "error", message: String(e) },
      }));
    }
  }

  async function skip(r: Result) {
    setCardStates((s) => ({ ...s, [r.save.id]: { kind: "skipping" } }));
    try {
      const res = await fetch("/api/ideate/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ save_id: r.save.id }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || `HTTP ${res.status}`);
      }
      setCardStates((s) => ({ ...s, [r.save.id]: { kind: "skipped" } }));
    } catch (e) {
      setCardStates((s) => ({
        ...s,
        [r.save.id]: { kind: "error", message: String(e) },
      }));
    }
  }

  if (!results) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-sm text-[var(--muted-foreground)]">
          {saves.length} new {saves.length === 1 ? "save" : "saves"} ready for
          ideation. Generating takes ~5-10s per save with gemini-2.5-pro (so
          ~{Math.max(saves.length * 7, 10)}s total).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={runIdeation}
            disabled={generating}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {generating ? "Generating ideas…" : `Generate ${saves.length} ${saves.length === 1 ? "idea" : "ideas"}`}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Voice:
            </span>
            <VoicePicker value={voiceId} onChange={setVoiceId} placeholder="(default)" />
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((r) => (
        <IdeaCard
          key={r.save.id}
          result={r}
          state={cardStates[r.save.id] || { kind: "pending" }}
          onApprove={() => approve(r)}
          onSkip={() => skip(r)}
        />
      ))}
    </div>
  );
}

function IdeaCard({
  result,
  state,
  onApprove,
  onSkip,
}: {
  result: Result;
  state: CardState;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const { save, proposal, error } = result;
  const handled =
    state.kind === "approved" ||
    state.kind === "skipped" ||
    state.kind === "approving" ||
    state.kind === "skipping";

  if (error || !proposal) {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
        <div className="text-sm font-medium">
          @{save.author} ({save.type})
        </div>
        <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          Ideation failed: {error || "no proposal"}
        </div>
      </div>
    );
  }

  if (proposal.skip) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 opacity-70">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            @{save.author} ({save.type}) — Gemini suggests skip
          </div>
          {state.kind === "skipped" ? (
            <span className="text-xs text-emerald-600">marked Reviewed</span>
          ) : (
            <button
              onClick={onSkip}
              disabled={handled}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs"
            >
              {state.kind === "skipping" ? "…" : "Mark Reviewed"}
            </button>
          )}
        </div>
        <div className="mt-1 text-xs text-[var(--muted-foreground)]">
          {proposal.skip_reason || "Not enough material."}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            @{save.author} · {save.type}
            {save.collection_name ? ` · ${save.collection_name}` : ""}
          </div>
          <h3 className="mt-1 text-xl font-semibold leading-tight">
            {proposal.name}
          </h3>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2 text-xs">
          <div className="flex gap-1.5">
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5">
              {proposal.pillar}
            </span>
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5">
              {proposal.priority}
            </span>
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5">
              {proposal.format}
            </span>
          </div>
          <div className="text-[var(--muted-foreground)]">
            {proposal.platforms.join(" · ")}
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-[var(--muted-foreground)] italic">
        {proposal.angle}
      </p>

      <details className="mb-3">
        <summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Hooks
        </summary>
        <div className="mt-2 space-y-1.5 text-sm">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              curiosity:
            </span>{" "}
            {proposal.hook_curiosity}
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              value:
            </span>{" "}
            {proposal.hook_value}
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              emotional:
            </span>{" "}
            {proposal.hook_emotional}
          </div>
        </div>
      </details>

      <details className="mb-3">
        <summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Outline
        </summary>
        <div className="mt-2 text-sm">
          <MarkdownView>{proposal.outline_md}</MarkdownView>
        </div>
      </details>

      {(proposal.ig_breakdown_md ||
        proposal.x_breakdown_md ||
        proposal.youtube_breakdown_md) && (
        <details className="mb-4">
          <summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Platform breakdowns
          </summary>
          <div className="mt-2 grid gap-3 lg:grid-cols-3">
            {[
              ["Instagram", proposal.ig_breakdown_md],
              ["X / Twitter", proposal.x_breakdown_md],
              ["YouTube", proposal.youtube_breakdown_md],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label as string}>
                  <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
                    {label}
                  </div>
                  <div className="rounded-md border border-[var(--border)] p-2 text-sm">
                    <MarkdownView>{value as string}</MarkdownView>
                  </div>
                </div>
              ))}
          </div>
        </details>
      )}

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        <a
          href={save.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--muted-foreground)] hover:underline"
        >
          View source post ↗
        </a>
        <div className="flex gap-2">
          {state.kind === "approved" ? (
            <a
              href={`/ideas/${state.idea_id}`}
              className="rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
            >
              ✓ Approved → open
            </a>
          ) : state.kind === "skipped" ? (
            <span className="text-xs text-[var(--muted-foreground)]">Marked Reviewed</span>
          ) : (
            <>
              <button
                onClick={onSkip}
                disabled={handled}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {state.kind === "skipping" ? "…" : "Skip"}
              </button>
              <button
                onClick={onApprove}
                disabled={handled}
                className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {state.kind === "approving" ? "Saving…" : "Approve & save"}
              </button>
            </>
          )}
        </div>
      </div>

      {state.kind === "error" && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
