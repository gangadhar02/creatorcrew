"use client";

import GenerativeCard from "./GenerativeCard";
import { Badge } from "@/components/ui/badge";
import type { CreatorSnapshotArgs } from "@/lib/tools";

interface CreatorAnalysisCardProps {
  args: CreatorSnapshotArgs;
}

function initials(s: string | null | undefined): string {
  const v = (s || "?").replace(/^@/, "").trim();
  return v.slice(0, 2).toUpperCase() || "?";
}

type Cell = { label: string; value: string };

function buildCells(args: CreatorSnapshotArgs): Cell[] {
  const cells: Cell[] = [];
  const round = (n: number) => Math.round(n).toLocaleString();
  if (args.followerCount != null)
    cells.push({ label: "FOLLOWERS", value: round(args.followerCount) });
  if (args.postsIndexed != null)
    cells.push({ label: "POSTS INDEXED", value: round(args.postsIndexed) });
  if (args.totalViews != null)
    cells.push({ label: "TOTAL VIEWS", value: round(args.totalViews) });
  if (args.avgViews != null)
    cells.push({ label: "AVG VIEWS", value: round(args.avgViews) });
  if (args.engagementRate != null)
    cells.push({
      label: "ENGAGEMENT",
      value: `${args.engagementRate.toLocaleString()}%`,
    });
  if (args.outlierMean != null)
    cells.push({
      label: "OUTLIER MEAN",
      value: `${args.outlierMean.toLocaleString()}x`,
    });
  if (args.outlierMedian != null)
    cells.push({
      label: "OUTLIER MEDIAN",
      value: `${args.outlierMedian.toLocaleString()}x`,
    });
  return cells;
}

export default function CreatorAnalysisCard({
  args,
}: CreatorAnalysisCardProps) {
  const cells = buildCells(args);

  return (
    <GenerativeCard label="CREATOR" title={`@${args.handle}`}>
      <div className="flex items-center gap-3">
        {args.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={args.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full object-cover bg-muted"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {initials(args.handle)}
          </span>
        )}
        <div className="min-w-0">
          {args.displayName ? (
            <div className="text-xs text-muted-foreground">
              {args.displayName}
            </div>
          ) : null}
          <Badge variant="secondary">{args.platform}</Badge>
        </div>
      </div>

      {cells.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {cells.map((c) => (
            <div key={c.label} className="p-2 rounded-md bg-muted/40">
              <div className="text-[10px] uppercase font-mono text-muted-foreground">
                {c.label}
              </div>
              <div className="text-base font-semibold text-foreground">
                {c.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {args.summary ? (
        <p className="text-sm text-muted-foreground">{args.summary}</p>
      ) : null}
    </GenerativeCard>
  );
}

export type { CreatorAnalysisCardProps };
