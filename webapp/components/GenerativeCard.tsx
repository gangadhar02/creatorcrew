"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface GenerativeCardProps {
  label: string; // uppercase shown verbatim, e.g. "BREAKDOWN", "6 POSTS"
  title?: string; // optional bold heading
  action?: React.ReactNode; // optional right-aligned action node (button / dropdown)
  children: React.ReactNode; // body
  className?: string;
}

export default function GenerativeCard({
  label,
  title,
  action,
  children,
  className,
}: GenerativeCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        className={cn(
          "overflow-hidden ring-1 ring-foreground/10 card-hover",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {label}
            </div>
            {title ? (
              <div className="font-heading text-base font-semibold text-foreground">
                {title}
              </div>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className="px-4 py-3 space-y-4">{children}</div>
      </Card>
    </motion.div>
  );
}

export type { GenerativeCardProps };
