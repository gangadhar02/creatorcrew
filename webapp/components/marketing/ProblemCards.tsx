"use client";

import { TrendingUp, FileX, Bot } from "lucide-react";

const items = [
  {
    icon: TrendingUp,
    title: "Trends move faster than you",
    body: "By the time you spot what's working in your niche, the wave has passed. Doomscrolling feeds all day is not a content strategy.",
  },
  {
    icon: FileX,
    title: "Blank-page burnout",
    body: "Figuring out what to post next is a grind. Every single day, and you're doing it alone.",
  },
  {
    icon: Bot,
    title: "AI that doesn't sound like you",
    body: "Generic writing tools spit out generic mush. Your audience can tell.",
  },
];

export function ProblemCards() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-14">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">The problem</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            You're a one-person content team.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group relative rounded-2xl bg-card ring-1 ring-border p-7 hover:ring-brand/40 transition-all"
            >
              <div className="grid place-items-center size-11 rounded-xl bg-brand/10 text-brand mb-5">
                <Icon className="size-5" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}