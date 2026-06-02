"use client";

import { EmailCaptureForm } from "./EmailCaptureForm";

export function FinalCta() {
  return (
    <section className="px-6 pb-24 pt-12">
      <div className="relative max-w-6xl mx-auto bg-foreground text-background rounded-[2.5rem] p-12 md:p-20 text-center overflow-hidden">
        <div className="absolute inset-0 dot-grid text-background opacity-[0.08] pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-[420px] rounded-full bg-brand/30 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">Start free</span>
          <h2 className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] mt-4 mb-5 text-balance max-w-3xl mx-auto">
            Meet the crew that creates with you.
          </h2>
          <p className="text-background/70 mb-9 max-w-xl mx-auto">
            Start free, no credit card. Early creators get extended AI credits.
          </p>
          <EmailCaptureForm variant="dark" />
        </div>
      </div>
    </section>
  );
}