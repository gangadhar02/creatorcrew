import { clsx } from "clsx";

const STYLES: Record<string, string> = {
  New: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  Reviewed: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  Used: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  "Not started":
    "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  "In progress":
    "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  Done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  High: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  Medium:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  Low: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

export default function StatusBadge({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[value] || "bg-zinc-200 text-zinc-700"
      )}
    >
      {value}
    </span>
  );
}
