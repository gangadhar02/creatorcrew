"use client";

export function Logo({ className }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2 ${className ?? ""}`} aria-label="Drafts home">
      <span className="relative grid place-items-center size-8 rounded-lg bg-brand">
        <span className="size-3 rounded-[3px] bg-brand-foreground rotate-12" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-foreground">Drafts</span>
    </a>
  );
}