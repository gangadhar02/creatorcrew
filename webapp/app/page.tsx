import type { Metadata } from "next";
import { headers } from "next/headers";
import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { SocialProof } from "@/components/marketing/SocialProof";
import { ProblemCards } from "@/components/marketing/ProblemCards";
import { BigIdea } from "@/components/marketing/BigIdea";
import { Features } from "@/components/marketing/Features";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Differentiators } from "@/components/marketing/Differentiators";
import { Roadmap } from "@/components/marketing/Roadmap";
import { Pricing } from "@/components/marketing/Pricing";
import { Faq } from "@/components/marketing/Faq";
import { FinalCta } from "@/components/marketing/FinalCta";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export const metadata: Metadata = {
  title: "CreatorCrew · Your AI content crew",
  description:
    "A crew of AI agents that create content with you. CreatorCrew tracks what's trending in your niche, learns your voice from your past posts, then ideates and writes in your tone.",
};

/**
 * Public marketing landing page at "/". Logged-in users are redirected to
 * /home by the proxy. The `.creatorcrew-landing` wrapper scopes the CreatorCrew design
 * tokens (defined in globals.css) so the landing keeps its own look without
 * affecting the rest of the app.
 */
export default async function LandingPage() {
  // Geo-pick the pricing currency from Vercel's edge header. India sees INR;
  // every other country (and local/preview, where the header is absent) sees
  // USD.
  const hdrs = await headers();
  const country = (hdrs.get("x-vercel-ip-country") || "").toUpperCase();
  const region: "USD" | "INR" = country === "IN" ? "INR" : "USD";

  return (
    <div className="creatorcrew-landing min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <SocialProof />
        <ProblemCards />
        <BigIdea />
        <Features />
        <HowItWorks />
        <Differentiators />
        <Roadmap />
        <Pricing region={region} />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
