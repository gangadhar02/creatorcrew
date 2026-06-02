import { redirect } from "next/navigation";
import { Check, Star } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { Logo } from "@/components/marketing/Logo";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

const VALUE_PROPS = [
  "A crew that tracks what's trending in your niche",
  "Learns your voice and writes in your tone",
  "Turns inspiration into ready-to-post ideas",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
}) {
  // If already signed in, bounce to home (or wherever they were headed).
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sp = await searchParams;
  if (user) redirect(sp.next || "/home");

  return (
    <div className="creatorcrew-landing relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Soft brand glow, echoing the landing hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-brand/10 via-brand/5 to-transparent" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-10 lg:grid-cols-2 lg:gap-16">
        {/* Left — brand & social proof */}
        <div className="hidden lg:block">
          <Logo />
          <h1 className="font-display mt-10 text-4xl font-semibold leading-[1.05] tracking-tight text-balance xl:text-5xl">
            A crew of AI agents that create content with you.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground text-pretty">
            CreatorCrew is your AI second brain for content. Your crew tracks
            your niche, learns your voice, and writes your next post in your
            tone.
          </p>

          <div className="mt-10 max-w-md rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-brand text-brand"
                    strokeWidth={0}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Loved by creators
              </span>
            </div>
            <ul className="mt-5 space-y-3">
              {VALUE_PROPS.map((prop) => (
                <li key={prop} className="flex items-center gap-3 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {prop}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right — auth card */}
        <div className="mx-auto w-full max-w-md">
          {/* Logo shows on mobile where the left column is hidden */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/[0.04] sm:p-8">
            <header className="mb-6 space-y-1.5 text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Get started
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in or create your account. No password needed.
              </p>
            </header>

            <LoginForm
              next={sp.next}
              initialError={sp.error}
              initialEmail={sp.email}
            />

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              By continuing, you agree to our{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">
                Terms
              </a>{" "}
              and{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
