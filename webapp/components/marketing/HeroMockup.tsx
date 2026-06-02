"use client";

import { Sparkles, Search, Hash, MessageSquare } from "lucide-react";

export function HeroMockup() {
  return (
    <div className="relative max-w-6xl mx-auto aspect-[16/10] bg-card rounded-3xl ring-1 ring-border overflow-hidden shadow-2xl shadow-black/10">
      <div className="absolute inset-0 dot-grid text-foreground/40 pointer-events-none" />

      {/* App chrome */}
      <div className="absolute inset-4 md:inset-6 bg-background/60 backdrop-blur-sm rounded-2xl border border-border flex overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-52 border-r border-border bg-card p-4 gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <span className="size-6 rounded-md bg-brand grid place-items-center">
              <span className="size-2 rounded-[2px] bg-brand-foreground rotate-12" />
            </span>
            <span className="font-display text-sm font-semibold">CreatorCrew</span>
          </div>
          <div className="space-y-1.5">
            <SidebarItem icon={<Sparkles className="size-3.5" />} label="Inbox" active />
            <SidebarItem icon={<Hash className="size-3.5" />} label="Hooks" />
            <SidebarItem icon={<Search className="size-3.5" />} label="Discover" />
            <SidebarItem icon={<MessageSquare className="size-3.5" />} label="Copilot" />
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground/70">Boards</div>
          <div className="space-y-1.5">
            <SidebarItem label="Minimalist setups" muted />
            <SidebarItem label="Hot takes" muted />
            <SidebarItem label="Reels Q4" muted />
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 relative p-6 md:p-10 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Board</div>
              <div className="font-display text-base font-semibold">Minimalist setups</div>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="px-2 py-1 rounded-full bg-secondary">12 saves</span>
              <span className="px-2 py-1 rounded-full bg-secondary">3 outliers</span>
            </div>
          </div>

          {/* Floating cards */}
          <FloatingCard className="absolute top-24 left-6 md:left-12 w-44 md:w-52 rotate-[-3deg] bg-amber-50 ring-amber-300/40 text-amber-900">
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1.5 opacity-70">Post idea</div>
            <div className="text-[11px] md:text-xs font-medium leading-snug">The psychology of a clean desk — why creators ship more.</div>
          </FloatingCard>

          <FloatingCard className="absolute top-44 left-1/3 w-44 md:w-56 rotate-[2deg] p-0 overflow-hidden">
            <div className="aspect-[4/3] bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-zinc-700 dark:to-zinc-800 grid place-items-center">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Reel · 124k views</span>
            </div>
            <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">@mattdgray · saved</div>
          </FloatingCard>

          <FloatingCard className="absolute bottom-10 left-12 md:left-24 w-44 rotate-[1deg] bg-brand/10 ring-brand/30 text-brand">
            <div className="text-[11px] font-medium italic leading-snug">"Less is more, but better is better."</div>
          </FloatingCard>

          <FloatingCard className="absolute bottom-20 right-8 w-48 md:w-56 rotate-[-2deg]">
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1.5 text-muted-foreground">Outlier · 8.4×</div>
            <div className="text-[11px] font-medium leading-snug mb-2">"I redesigned my room in 6 days. Here's what I cut."</div>
            <div className="flex gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-secondary text-[9px] text-muted-foreground">vlog</span>
              <span className="px-1.5 py-0.5 rounded bg-secondary text-[9px] text-muted-foreground">space</span>
            </div>
          </FloatingCard>
        </main>

        {/* Chat copilot */}
        <aside className="hidden lg:flex flex-col w-72 border-l border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Copilot</span>
          </div>
          <div className="flex-1 space-y-3">
            <div className="bg-secondary rounded-xl rounded-tl-sm px-3 py-2.5 text-[11px] leading-relaxed text-foreground/80">
              I analyzed your 12 saves on this board. Want a thread on "what to remove from your desk"?
            </div>
            <div className="bg-brand/10 ring-1 ring-brand/20 rounded-xl rounded-tr-sm px-3 py-2.5 text-[11px] leading-relaxed text-foreground ml-6">
              Yes — make it sound like me, hook first.
            </div>
            <div className="bg-secondary rounded-xl rounded-tl-sm px-3 py-2.5 text-[11px] leading-relaxed text-foreground/80">
              <span className="font-semibold">Hook:</span> "Your desk isn't messy. It's loud." Drafting 6 lines in your voice…
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
            <span className="text-[11px] text-muted-foreground flex-1">Ask CreatorCrew…</span>
            <span className="grid place-items-center size-6 rounded-md bg-brand text-brand-foreground text-xs">↑</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  muted,
}: {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
        active
          ? "bg-brand/10 text-brand font-medium"
          : muted
          ? "text-muted-foreground"
          : "text-foreground/70 hover:bg-secondary"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

function FloatingCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl bg-card ring-1 ring-border shadow-lg shadow-black/10 p-3 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}