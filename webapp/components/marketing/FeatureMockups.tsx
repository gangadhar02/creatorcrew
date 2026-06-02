"use client";

import { Search, Sparkles, TrendingUp, BarChart3, Mic, MessageSquare, Image as ImageIcon, Hash } from "lucide-react";

function Frame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="relative rounded-3xl bg-card ring-1 ring-border shadow-xl shadow-black/[0.06] p-5 md:p-7 overflow-hidden">
      <div className="flex items-center gap-1.5 mb-4">
        <span className="size-2.5 rounded-full bg-foreground/10" />
        <span className="size-2.5 rounded-full bg-foreground/10" />
        <span className="size-2.5 rounded-full bg-foreground/10" />
        {label && (
          <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function SaveMockup() {
  const items = [
    { tag: "Reel", title: "8 desk setups that ship", color: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" },
    { tag: "Carousel", title: "Why hooks fail", color: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200" },
    { tag: "Post", title: "Anatomy of a viral thread", color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200" },
    { tag: "Reel", title: "The 1-take rule", color: "bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200" },
  ];
  return (
    <Frame label="Library">
      <div className="flex items-center gap-2 mb-4 rounded-xl bg-secondary px-3 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Search 1,248 saves…</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl bg-background ring-1 ring-border p-3">
            <div className="aspect-[5/4] rounded-lg bg-gradient-to-br from-secondary to-background mb-3 grid place-items-center">
              <ImageIcon className="size-5 text-muted-foreground/40" />
            </div>
            <span className={`inline-block text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${it.color}`}>{it.tag}</span>
            <div className="text-xs font-medium mt-1.5 leading-snug">{it.title}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function VisionMockup() {
  const tags = ["minimal desk", "warm light", "voiceover", "talk-to-camera", "split-screen hook", "kinetic text"];
  return (
    <Frame label="Vision analysis">
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-2 aspect-[3/4] rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-zinc-700 dark:to-zinc-800 ring-1 ring-border grid place-items-center">
          <ImageIcon className="size-6 text-muted-foreground/40" />
        </div>
        <div className="col-span-3 space-y-2.5">
          <div className="rounded-lg bg-secondary px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Transcript</div>
            <div className="text-[11px] leading-relaxed text-foreground/80">
              "The thing nobody tells you about a creative practice is that consistency is the moat. Here's what changed for me…"
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function DiscoverMockup() {
  const rows = [
    { name: "@mattdgray", post: "I quit Notion. Here's what I use.", mult: "12.4×", color: "bg-brand text-brand-foreground" },
    { name: "@nilssonbee", post: "Studio tour, no edit", mult: "6.1×", color: "bg-foreground text-background" },
    { name: "@curiouspeter", post: "5 hooks I steal weekly", mult: "4.7×", color: "bg-secondary text-foreground" },
  ];
  return (
    <Frame label="Outliers · this week">
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 rounded-xl bg-background ring-1 ring-border p-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-secondary to-card ring-1 ring-border grid place-items-center">
              <TrendingUp className="size-4 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-muted-foreground">{r.name}</div>
              <div className="text-sm font-medium truncate">{r.post}</div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${r.color}`}>{r.mult}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function ProfileMockup() {
  return (
    <Frame label="Profile analyzer">
      <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border">
        <div className="size-12 rounded-full bg-gradient-to-br from-brand to-amber-400" />
        <div className="flex-1">
          <div className="text-sm font-semibold">@studio_nine</div>
          <div className="text-[11px] text-muted-foreground">124k followers · 312 posts</div>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">Analyzed</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { l: "Avg views", v: "48k" },
          { l: "Engagement", v: "5.8%" },
          { l: "Outliers", v: "9" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-secondary p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="font-display text-xl font-semibold mt-0.5">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {[40, 60, 35, 78, 50, 92, 45, 58, 70, 38, 84, 52].map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${h > 80 ? "bg-brand" : "bg-foreground/15"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
        <BarChart3 className="size-3" /> Reel performance · last 12 posts
      </div>
    </Frame>
  );
}

export function CopilotMockup() {
  return (
    <Frame label="Copilot">
      <div className="space-y-3">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand/10 text-foreground px-3.5 py-2.5 text-xs leading-relaxed ring-1 ring-brand/20">
            Write me a hook for a reel about why creators procrastinate.
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="size-7 rounded-full bg-foreground text-background grid place-items-center shrink-0">
            <Sparkles className="size-3.5" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-xs leading-relaxed text-foreground/85">
            Based on 23 reels in your "Hooks" board and your voice profile, here are three options:
            <div className="mt-2 space-y-1.5">
              <div className="rounded-lg bg-card ring-1 ring-border px-2.5 py-1.5 text-[11px]">"You're not lazy. You're just scared the work is bad."</div>
              <div className="rounded-lg bg-card ring-1 ring-border px-2.5 py-1.5 text-[11px]">"Procrastination is a vibe check on your idea."</div>
              <div className="rounded-lg bg-card ring-1 ring-border px-2.5 py-1.5 text-[11px]">"The hardest part of the post is opening the app."</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-secondary px-3 py-2.5 flex items-center gap-2">
          <MessageSquare className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground flex-1">Make it punchier · use my last viral hook…</span>
          <span className="grid place-items-center size-6 rounded-md bg-brand text-brand-foreground text-xs">↑</span>
        </div>
      </div>
    </Frame>
  );
}

export function VoiceMockup() {
  return (
    <Frame label="Voice fingerprint">
      <div className="flex items-center gap-3 mb-5">
        <span className="grid place-items-center size-10 rounded-xl bg-brand/15 text-brand">
          <Mic className="size-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">Your voice</div>
          <div className="text-[11px] text-muted-foreground">Captured from 42 posts</div>
        </div>
        <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">Locked in</span>
      </div>
      <div className="space-y-3">
        {[
          { l: "Pacing", v: 78, n: "Short, punchy sentences" },
          { l: "Vocab", v: 62, n: "Plain, creator-native" },
          { l: "POV", v: 88, n: "First-person, direct" },
          { l: "Humor", v: 45, n: "Dry, occasional" },
        ].map((d) => (
          <div key={d.l}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-medium">{d.l}</span>
              <span className="text-muted-foreground">{d.n}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width: `${d.v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function CanvasMockup() {
  return (
    <Frame label="Canvas">
      <div className="relative h-72 rounded-xl bg-background ring-1 ring-border dot-grid text-foreground/30 overflow-hidden">
        <div className="absolute top-5 left-5 w-40 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/15 ring-1 ring-amber-300/40 rotate-[-3deg] shadow-sm">
          <div className="text-[9px] uppercase tracking-wider font-semibold text-amber-900 dark:text-amber-200 mb-1">Note</div>
          <div className="text-[11px] text-amber-900 dark:text-amber-100">Open with a confession, not a stat.</div>
        </div>
        <div className="absolute top-12 right-6 w-44 rounded-lg bg-card ring-1 ring-border rotate-[2deg] overflow-hidden shadow-sm">
          <div className="aspect-video bg-gradient-to-br from-secondary to-card grid place-items-center">
            <ImageIcon className="size-4 text-muted-foreground/40" />
          </div>
          <div className="p-2 text-[10px] text-muted-foreground">Reel · @nilssonbee</div>
        </div>
        <div className="absolute bottom-6 left-1/4 w-36 p-3 rounded-lg bg-brand/10 ring-1 ring-brand/30 rotate-[1deg] shadow-sm">
          <div className="text-[10px] font-semibold text-brand italic">"Less but better."</div>
        </div>
        <div className="absolute bottom-10 right-1/4 w-32 p-3 rounded-lg bg-card ring-1 ring-border rotate-[-2deg] shadow-sm">
          <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Idea</div>
          <div className="text-[10px]">"Why I deleted my second monitor"</div>
        </div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          <path d="M 110 60 Q 180 120 230 140" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-brand/50" strokeDasharray="4 4" />
        </svg>
      </div>
    </Frame>
  );
}

export function IdeationMockup() {
  const pillars = [
    { name: "Studio life", color: "bg-amber-500", ideas: ["Why my desk is loud", "1-take culture", "Ship-day rituals"] },
    { name: "Creator econ", color: "bg-sky-500", ideas: ["Pricing my first brand deal", "When to hire an editor"] },
    { name: "Hooks lab", color: "bg-emerald-500", ideas: ["Confession openers", "Counter-intuitive frames", "Story-first hooks"] },
  ];
  return (
    <Frame label="Pillars">
      <div className="grid grid-cols-3 gap-3">
        {pillars.map((p) => (
          <div key={p.name} className="rounded-xl bg-background ring-1 ring-border p-3">
            <div className="flex items-center gap-1.5 mb-3">
              <span className={`size-2 rounded-full ${p.color}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{p.name}</span>
            </div>
            <div className="space-y-1.5">
              {p.ideas.map((i) => (
                <div key={i} className="rounded-md bg-card ring-1 ring-border px-2 py-1.5 text-[10px] leading-snug">
                  <Hash className="inline size-2.5 mr-1 text-muted-foreground" />
                  {i}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}