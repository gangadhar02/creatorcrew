"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Voice } from "@/lib/types";
import MarkdownView from "./MarkdownView";

const SECTIONS: { key: keyof Voice; label: string; placeholder?: string }[] = [
  { key: "mission_md", label: "Mission" },
  { key: "audience_md", label: "Audience" },
  { key: "pov_md", label: "Point of view" },
  { key: "core_ideas_md", label: "Core ideas" },
  { key: "tone_md", label: "Tone" },
  { key: "always_do_md", label: "Always do" },
  { key: "avoid_md", label: "Avoid" },
  { key: "formatting_md", label: "Formatting" },
  { key: "writing_samples_md", label: "Writing samples" },
];

export default function VoiceDetailClient({ initial }: { initial: Voice }) {
  const router = useRouter();
  const [voice, setVoice] = useState<Voice>(initial);
  const [editing, setEditing] = useState<keyof Voice | null>(null);
  const [refining, setRefining] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [refineMsg, setRefineMsg] = useState<string | null>(null);

  async function patchVoice(patch: Partial<Voice>) {
    const res = await fetch(`/api/voice/${voice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
  }

  async function saveField(key: keyof Voice, value: string) {
    await patchVoice({ [key]: value } as Partial<Voice>);
    setVoice((v) => ({ ...v, [key]: value }));
    setEditing(null);
  }

  async function toggleDefault() {
    const next = !voice.is_default;
    await patchVoice({ is_default: next });
    setVoice((v) => ({ ...v, is_default: next }));
    router.refresh();
  }

  async function submitRefine() {
    if (!refineText.trim()) return;
    setRefining(true);
    setRefineMsg(null);
    try {
      const res = await fetch(`/api/voice/${voice.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: refineText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRefineMsg(
        `${data.summary || "Refined"} (changed: ${(data.changed_fields || []).join(", ") || "none"})`
      );
      setRefineText("");
      // Re-fetch the voice
      const fresh = await fetch(`/api/voice/${voice.id}`).then((r) => r.json());
      setVoice(fresh as Voice);
    } catch (e) {
      setRefineMsg(`Error: ${e}`);
    } finally {
      setRefining(false);
    }
  }

  async function deleteVoice() {
    if (!confirm(`Delete "${voice.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/voice/${voice.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/voice");
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Delete failed");
    }
  }

  const vocab = (voice.vocabulary as { preferred?: string[]; avoid?: string[] }) || {};

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {voice.is_default && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                default
              </span>
            )}
            {voice.is_archetype && (
              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-900 dark:bg-sky-900/30 dark:text-sky-200">
                archetype
              </span>
            )}
          </div>
          {editing === "name" ? (
            <EditField
              initial={voice.name}
              onSave={(v) => saveField("name", v)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <h1
              className="text-3xl font-semibold cursor-pointer hover:opacity-80"
              onClick={() => !voice.is_archetype && setEditing("name")}
            >
              {voice.name}
            </h1>
          )}
          {voice.archetype && voice.archetype !== voice.name && (
            <div className="text-sm text-[var(--muted-foreground)] mt-1">{voice.archetype}</div>
          )}
        </div>
        {!voice.is_archetype && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleDefault}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--border)]/40"
            >
              {voice.is_default ? "Unset default" : "Set as default"}
            </button>
            <button
              onClick={deleteVoice}
              className="rounded-md border border-rose-300 text-rose-600 dark:border-rose-900 dark:text-rose-400 px-3 py-1.5 text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Delete
            </button>
          </div>
        )}
      </header>

      {/* Refine via chat */}
      {!voice.is_archetype && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Refine via instruction
          </h2>
          <div className="flex gap-2">
            <input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitRefine()}
              placeholder="e.g. shorter sentences, drop the corporate vocabulary, lean more contrarian"
              disabled={refining}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
            />
            <button
              onClick={submitRefine}
              disabled={refining || refineText.trim().length < 5}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {refining ? "Refining…" : "Refine"}
            </button>
          </div>
          {refineMsg && (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">{refineMsg}</p>
          )}
        </section>
      )}

      {/* Sections */}
      {SECTIONS.map((s) => {
        const current = (voice[s.key] as string | null) || "";
        const isEditing = editing === s.key;
        return (
          <section key={String(s.key)}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
                {s.label}
              </h2>
              {!voice.is_archetype && !isEditing && (
                <button
                  onClick={() => setEditing(s.key)}
                  className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  edit
                </button>
              )}
            </div>
            {isEditing ? (
              <EditField
                multiline
                initial={current}
                onSave={(v) => saveField(s.key, v)}
                onCancel={() => setEditing(null)}
              />
            ) : current ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <MarkdownView>{current}</MarkdownView>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-xs text-[var(--muted-foreground)]">
                (empty)
              </div>
            )}
          </section>
        );
      })}

      {/* Vocabulary */}
      <section>
        <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Vocabulary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1.5">
              Preferred
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(vocab.preferred || []).map((w) => (
                <span
                  key={w}
                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
                >
                  {w}
                </span>
              ))}
              {(vocab.preferred || []).length === 0 && (
                <span className="text-xs text-[var(--muted-foreground)]">(none)</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1.5">
              Avoid
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(vocab.avoid || []).map((w) => (
                <span
                  key={w}
                  className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-900 dark:bg-rose-900/30 dark:text-rose-200"
                >
                  {w}
                </span>
              ))}
              {(vocab.avoid || []).length === 0 && (
                <span className="text-xs text-[var(--muted-foreground)]">(none)</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Source links */}
      {Array.isArray(voice.source_links) && voice.source_links.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Source links
          </h2>
          <ul className="space-y-1 text-xs">
            {voice.source_links.map((u, i) => (
              <li key={i}>
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline truncate block"
                >
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EditField({
  initial,
  multiline,
  onSave,
  onCancel,
}: {
  initial: string;
  multiline?: boolean;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function commit() {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        />
      ) : (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-3xl font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={commit}
          disabled={saving}
          className="rounded-md bg-[var(--primary)] px-3 py-1 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
