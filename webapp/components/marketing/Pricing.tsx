import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Region = "USD" | "INR";

const tiers = [
  {
    name: "Free",
    tagline: "Try it. Limited saves, ideas, and analyses.",
    price: { USD: "$0", INR: "₹0" },
    cta: "Start free",
    href: "/login",
    featured: false,
    features: ["100 saves", "Basic AI tagging", "1 canvas board", "Community access"],
  },
  {
    name: "Creator",
    tagline: "For active creators. Generous AI credits, voice, and canvas.",
    price: { USD: "$19", INR: "₹499" },
    cta: "Get Creator",
    href: "/subscribe?plan=creator",
    featured: true,
    features: ["Unlimited saves", "Voice fingerprint", "Outlier detection", "Infinite canvas boards", "Generous AI credits"],
  },
  {
    name: "Pro",
    tagline: "For power creators. More credits plus early access to Bio and DMs.",
    price: { USD: "$39", INR: "₹1,299" },
    cta: "Go Pro",
    href: "/subscribe?plan=pro",
    featured: false,
    features: ["Everything in Creator", "3× AI credits", "Early access: Link-in-bio", "Early access: DM automation", "Priority support"],
  },
];

export function Pricing({ region = "USD" }: { region?: Region }) {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand">Pricing</span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight mt-3 text-balance">
            Replace 3+ tools with one.
          </h2>
          <p className="text-muted-foreground mt-4">Start free. Upgrade when you're shipping daily.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto mt-12">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "relative rounded-3xl p-8 flex flex-col",
                t.featured
                  ? "bg-foreground text-background ring-2 ring-brand shadow-2xl shadow-brand/20 md:-translate-y-2"
                  : "bg-card ring-1 ring-border",
              )}
            >
              {t.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full bg-brand text-brand-foreground">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-xl font-semibold">{t.name}</h3>
              <p className={cn("text-sm mt-1.5 mb-6", t.featured ? "text-background/70" : "text-muted-foreground")}>
                {t.tagline}
              </p>
              <div className="flex items-baseline gap-1.5 mb-7">
                <span className="font-display text-5xl font-semibold tracking-tight">{t.price[region]}</span>
                <span className={cn("text-sm", t.featured ? "text-background/50" : "text-muted-foreground")}>/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={cn(
                        "grid place-items-center size-5 rounded-full mt-0.5 shrink-0",
                        t.featured ? "bg-brand/20 text-brand" : "bg-brand/15 text-brand",
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className={cn(t.featured ? "text-background/90" : "text-foreground/85")}>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={t.href}
                className={cn(
                  "w-full text-center py-3 rounded-xl text-sm font-semibold transition-all",
                  t.featured
                    ? "bg-brand text-brand-foreground hover:brightness-110"
                    : "bg-foreground text-background hover:opacity-90",
                )}
              >
                {t.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-8">
          AI usage runs on a credit system included in each plan. Annual billing saves ~20%.
        </p>
      </div>
    </section>
  );
}