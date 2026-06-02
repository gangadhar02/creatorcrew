import type { Metadata } from "next";
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
  title: "Drafts — Your AI creative second brain",
  description:
    "Turn everything you save into your next post. Drafts learns your taste and helps you ideate, plan, and write — in your own voice.",
};

/**
 * Public marketing landing page at "/". Logged-in users are redirected to
 * /home by the proxy. The `.drafts-landing` wrapper scopes the Drafts design
 * tokens (defined in globals.css) so the landing keeps its own look without
 * affecting the rest of the app.
 */
export default function LandingPage() {
  return (
    <div className="drafts-landing min-h-screen bg-background text-foreground">
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
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
