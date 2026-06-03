"use client";

import { LinkIcon, MessagesSquare, Wand2 } from "lucide-react";

const items = [
  { icon: LinkIcon, title: "Link-in-bio", body: "A beautiful, customizable link-in-bio page, built into the same tool." },
  { icon: MessagesSquare, title: "DM automation", body: "Auto-reply to comments and DMs, run comment-to-DM funnels, turn engagement into leads." },
  { icon: Wand2, title: "AI carousels & videos", body: "Go from idea to finished carousel or short-form video, all in your style." },
];

export function Roadmap() {
  return (
    <section className="py-24 px-6 bg-card/40 border-y border-border">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-14">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">Roadmap</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            Coming soon to your workspace.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="relative rounded-2xl bg-card ring-1 ring-border p-7">
              <span className="absolute top-5 right-5 text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full bg-brand/10 text-brand">
                Soon
              </span>
              <span className="grid place-items-center size-10 rounded-xl bg-secondary text-foreground/70 mb-5">
                <Icon className="size-5" />
              </span>
              <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}