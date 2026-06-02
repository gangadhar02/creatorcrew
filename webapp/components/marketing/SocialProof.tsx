"use client";

export function SocialProof() {
  return (
    <section className="py-14 px-6 border-y border-border bg-card/40">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-8">
          Trusted by creators · your logo here
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-8 gap-y-6 items-center">
          {["Studio 9", "Roam·co", "Northbound", "Mira&Co", "Field Notes", "Atelier"].map((name) => (
            <div
              key={name}
              className="font-display text-base md:text-lg font-semibold text-muted-foreground/60 text-center tracking-tight"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}