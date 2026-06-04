"use client";

import Link from "next/link";

type Props = {
  title: string;
  subtitle?: string;
  index: number;
  active: boolean;
  openInNewTabHref?: string;
  onFocus: () => void;
  onClose: () => void;
  children: React.ReactNode;
};

export default function PaneFrame({
  title,
  subtitle,
  index,
  active,
  openInNewTabHref,
  onFocus,
  onClose,
  children,
}: Props) {
  return (
    <section
      onClick={onFocus}
      className={
        "flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border " +
        (active
          ? "border-[var(--primary)]/70 ring-1 ring-[var(--primary)]/40"
          : "border-[var(--border)]") +
        " bg-[var(--card)]"
      }
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="rounded bg-[var(--border)]/50 px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted-foreground)]">
          ⌥{index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--foreground)]">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-[10px] text-[var(--muted-foreground)]">
              {subtitle}
            </div>
          )}
        </div>
        {openInNewTabHref && (
          <Link
            href={openInNewTabHref}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)]/40"
            title="Open full view"
          >
            <ExpandIcon />
          </Link>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded p-1 text-[var(--muted-foreground)] hover:text-destructive hover:bg-destructive/10"
          title="Close pane"
        >
          <CloseIcon />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </section>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}
