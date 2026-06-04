import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { utcDayString } from "@/lib/activity";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Activity heatmap for the CURRENT calendar month, as a full-width month grid.
 *
 * Server component: renders once with the server clock, so no hydration
 * concerns. Filled cells are days the workspace was active this month.
 */
export default function StreakTracker({
  activeDays,
  streak,
}: {
  activeDays: Set<string>;
  streak: number;
}) {
  const today = utcDayString();
  const now = new Date(today + "T00:00:00.000Z");
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-11

  const monthLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // leading blanks
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: {
    dayNum: number;
    active: boolean;
    future: boolean;
    isToday: boolean;
  }[] = [];
  let activeThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    const active = activeDays.has(day);
    if (active) activeThisMonth += 1;
    cells.push({
      dayNum: d,
      active,
      future: day > today,
      isToday: day === today,
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Activity</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Flame
            className={cn(
              "size-3.5",
              streak > 0 ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span className="font-medium text-foreground tabular-nums">
            {streak}
          </span>
          <span>day streak</span>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          {monthLabel}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              className="pb-1 text-center text-[10px] font-medium text-muted-foreground"
            >
              {w}
            </div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {cells.map((cell) => (
            <div
              key={cell.dayNum}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                cell.active
                  ? "bg-primary font-medium text-primary-foreground"
                  : cell.future
                    ? "text-muted-foreground/40"
                    : "bg-muted text-muted-foreground",
                cell.isToday && !cell.active && "ring-1 ring-primary/50"
              )}
            >
              {cell.dayNum}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {activeThisMonth} active{" "}
            {activeThisMonth === 1 ? "day" : "days"} this month
          </span>
          <span className="flex items-center gap-1.5">
            Less
            <span className="size-3 rounded-[3px] bg-muted" />
            <span className="size-3 rounded-[3px] bg-primary/40" />
            <span className="size-3 rounded-[3px] bg-primary" />
            More
          </span>
        </div>
      </div>
    </section>
  );
}
