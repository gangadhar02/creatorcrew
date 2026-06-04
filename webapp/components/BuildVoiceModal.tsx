"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import type { Voice } from "@/lib/types";

type Mode = "menu" | "links" | "archetype" | "chat";

// Crisp display copy for the archetype cards (the stored mission_md is longer;
// this keeps the picker scannable). Keyed by archetype name.
const ARCHETYPE_META: Record<string, { emoji: string; blurb: string }> = {
  "The Founder": {
    emoji: "🛠️",
    blurb: "Builder mid-build. Story first, framework never. Specific scars beat clean advice.",
  },
  "The Contrarian": {
    emoji: "🗡️",
    blurb: "Finds the assumption everyone is making and asks why. Argues the position no one else will.",
  },
  "The Philosopher": {
    emoji: "🔭",
    blurb: "Asks more than answers. Leads the reader to their own conclusion with the sharper question.",
  },
  "The Operator": {
    emoji: "⚙️",
    blurb: "No fluff. Lists, steps, tradeoffs. Tells you what to do today, not what to feel about it.",
  },
  "The Educator": {
    emoji: "📐",
    blurb: "Makes the complicated thing obvious. Examples first, theory last, generous with the why.",
  },
  "The Creative": {
    emoji: "🎨",
    blurb: "Reaches for the unexpected image. Writes the one line the reader has to screenshot.",
  },
};

export default function BuildVoiceModal({
  open,
  onClose,
  initialMode = "menu",
}: {
  open: boolean;
  onClose: () => void;
  /** Which screen to open on (lets onboarding deep-link a chosen method). */
  initialMode?: Mode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [archetypes, setArchetypes] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (open && archetypes.length === 0) {
      fetch("/api/voices")
        .then((r) => r.json())
        .then((d) => setArchetypes((d.archetypes || []) as Voice[]))
        .catch(() => {});
    }
  }, [open, archetypes.length]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submitLinks(urls: string[], saveToBoard: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "links", urls, saveToBoard }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/voice/${data.voice_id}`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitArchetype(archetypeId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "archetype", archetypeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/voice/${data.voice_id}`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitChat(text: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "chat",
          conversation: [{ role: "user", content: text }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/voice/${data.voice_id}`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function startGuidedChat() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/build-chat", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.chat_id) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.push(`/chats/${data.chat_id}`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <FingerprintIcon />
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
              Step 1
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>

        {mode === "menu" && (
          <MenuView
            archetypeCount={archetypes.length}
            onPick={(m) => {
              if (m === "chat") startGuidedChat();
              else setMode(m);
            }}
          />
        )}
        {mode === "links" && (
          <LinksView
            loading={loading}
            onBack={() => setMode("menu")}
            onSubmit={submitLinks}
          />
        )}
        {mode === "archetype" && (
          <ArchetypeView
            archetypes={archetypes}
            loading={loading}
            onBack={() => setMode("menu")}
            onSubmit={submitArchetype}
          />
        )}
        {mode === "chat" && (
          <ChatView
            loading={loading}
            onBack={() => setMode("menu")}
            onSubmit={submitChat}
          />
        )}

        {error && (
          <div className="border-t border-[var(--border)] bg-rose-50 dark:bg-rose-950/30 px-5 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="border-t border-[var(--border)] bg-[var(--background)] px-5 py-2 text-[11px] text-[var(--muted-foreground)]">
          As you&apos;re chatting, you can always say{" "}
          <b className="text-[var(--foreground)]">&ldquo;update my voice&rdquo;</b>{" "}
          to refine it as you go.
        </div>
      </div>
    </div>
  );
}

function MenuView({
  archetypeCount,
  onPick,
}: {
  archetypeCount: number;
  onPick: (m: Mode) => void;
}) {
  return (
    <div className="px-5 pt-4 pb-5 space-y-3">
      <h2 className="text-xl font-semibold leading-tight">
        Your voice is your intellectual signature,
        <br />
        your ideas depend on it.
      </h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        CreatorCrew grounds everything it writes for you in the voice you set
        here. Get it close now, and your drafts stop sounding like everyone
        else&apos;s AI.
      </p>
      <div className="pt-2 space-y-2">
        <OptionCard
          tag="RECOMMENDED · ~5 MIN"
          title="Build via chat"
          desc="A guided conversation excavates your mission, influences, and the patterns you already write in. The deepest version."
          cta="Start chat →"
          onClick={() => onPick("chat")}
        />
        <OptionCard
          tag="~2 MIN"
          title="Paste links of your content"
          desc="Paste up to 5 links to your YouTube videos, posts, reels, or articles. We read each one and build a voice from the actual content."
          cta="Paste links →"
          onClick={() => onPick("links")}
        />
        <OptionCard
          tag="FASTEST · ~1 MIN"
          title="Pick a starting point"
          desc={`Six archetype voices (The Founder, The Contrarian, The Philosopher, The Operator, The Educator, The Creative). Pick one and refine from there. ${
            archetypeCount === 0 ? "(Loading…)" : ""
          }`}
          cta="See templates →"
          onClick={() => onPick("archetype")}
        />
      </div>
    </div>
  );
}

function OptionCard({
  tag,
  title,
  desc,
  cta,
  onClick,
}: {
  tag: string;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 transition-colors hover:border-[var(--primary)]/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            {tag}
          </div>
          <div className="font-medium">{title}</div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed">
            {desc}
          </p>
        </div>
        <span className="shrink-0 text-sm">{cta}</span>
      </div>
    </button>
  );
}

function LinksView({
  loading,
  onBack,
  onSubmit,
}: {
  loading: boolean;
  onBack: () => void;
  onSubmit: (urls: string[], saveToBoard: boolean) => void;
}) {
  const [rows, setRows] = useState<string[]>([""]);
  const [saveToBoard, setSaveToBoard] = useState(true);

  return (
    <div className="px-5 pt-4 pb-5 space-y-3">
      <h3 className="text-base font-semibold">Paste links of your content</h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        We&apos;ll read each link and build your voice from the content. YouTube
        videos, X / Twitter threads, Substack posts, Instagram, TikTok, and most
        blog posts work.
      </p>
      <div className="space-y-2">
        {rows.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[var(--muted-foreground)]">🔗</span>
            <input
              type="url"
              value={v}
              onChange={(e) => {
                const next = [...rows];
                next[i] = e.target.value;
                setRows(next);
              }}
              placeholder="https://youtube.com/watch?v=…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>
        ))}
        {rows.length < 5 && (
          <button
            type="button"
            onClick={() => setRows((r) => [...r, ""])}
            className="w-full rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            → Add another link
          </button>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-[var(--border)] p-3">
        <input
          type="checkbox"
          checked={saveToBoard}
          onChange={(e) => setSaveToBoard(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-xs">
          <span className="font-medium">Also save these links to a board</span>
          <span className="block text-[var(--muted-foreground)]">
            We&apos;ll drop them on a <b>Voice Sources</b> board so you can come
            back to them whenever you need more context to draft from.
          </span>
        </span>
      </label>

      <p className="text-[11px] text-[var(--muted-foreground)]">
        Tip: 2 to 3 links you&apos;re most proud of beats 5 random ones.
      </p>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← back
        </button>
        <button
          onClick={() => {
            const urls = rows.map((r) => r.trim()).filter((r) => r.length > 0);
            if (urls.length === 0) return;
            onSubmit(urls, saveToBoard);
          }}
          disabled={loading || rows.every((r) => !r.trim())}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {loading ? "Reading + extracting…" : "Create voice"}
        </button>
      </div>
    </div>
  );
}

function ArchetypeView({
  archetypes,
  loading,
  onBack,
  onSubmit,
}: {
  archetypes: Voice[];
  loading: boolean;
  onBack: () => void;
  onSubmit: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="px-5 pt-4 pb-5 space-y-3">
      <h3 className="text-base font-semibold">Pick a starting point</h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        Each archetype produces a distinctly different chat. Edit any field
        after.
      </p>
      <div className="grid grid-cols-2 gap-2 max-h-[44vh] overflow-y-auto">
        {archetypes.map((a) => {
          const active = picked === a.id;
          const meta = ARCHETYPE_META[a.name];
          return (
            <button
              key={a.id}
              onClick={() => setPicked(a.id)}
              className={clsx(
                "block w-full text-left rounded-lg border p-3 transition-colors",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--border)] hover:border-[var(--primary)]/50"
              )}
            >
              <div className="flex items-center gap-1.5 font-medium text-sm">
                {meta?.emoji && <span>{meta.emoji}</span>}
                {a.name}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)] line-clamp-3">
                {meta?.blurb || a.mission_md || a.pov_md || ""}
              </p>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← back
        </button>
        <button
          onClick={() => picked && onSubmit(picked)}
          disabled={!picked || loading}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {loading ? "Creating…" : "Use this voice"}
        </button>
      </div>
    </div>
  );
}

function ChatView({
  loading,
  onBack,
  onSubmit,
}: {
  loading: boolean;
  onBack: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="px-5 pt-4 pb-5 space-y-3">
      <h3 className="text-base font-semibold">Tell me about your voice</h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        Until full multi-turn chat ships (Phase 10), this is a single-turn
        prompt. Write 100-500 words about who you write for, what you stand for,
        and what you sound like. Quote yourself if you can. I&apos;ll extract a
        structured voice from it.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="My audience is… / What I believe that most people in my space don't… / I always avoid… / A line I'd write that nobody else would…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
      />
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← back
        </button>
        <button
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={loading || text.trim().length < 50}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {loading ? "Extracting…" : "Extract voice"}
        </button>
      </div>
    </div>
  );
}

function FingerprintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700 dark:text-emerald-400">
      <path d="M12 11v3M9 9.5a3 3 0 016 0c0 2.5-1.5 3.5-3 5.5M6.5 11.5a5.5 5.5 0 0111 0c0 4-2 5.5-4 8M4 14a8 8 0 0116 0c0 5-3 7-5 11" />
    </svg>
  );
}
