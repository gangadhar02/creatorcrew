"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  User,
  Users,
  Compass,
  LayoutGrid,
  Zap,
  MessageCircle,
  Link2,
  Fingerprint,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BuildVoiceModal from "./BuildVoiceModal";

type VoiceMode = "menu" | "links" | "archetype" | "chat";

const TOUR: {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    eyebrow: "Discover",
    title: "Discover posts that already work",
    body: "Discover surfaces the outliers in your space (the posts that did 10x what the creator usually pulls). Filter by topic, sort by views, and capture the ones worth a second look.",
    icon: Compass,
  },
  {
    eyebrow: "Boards",
    title: "Capture anything to a board",
    body: "Boards are where your raw material lives. Paste a link, drop a post from Discover, or jot a quick note. Group them however you think (a campaign, a thesis, a swipe file).",
    icon: LayoutGrid,
  },
  {
    eyebrow: "Boost",
    title: "Get post variations in one click",
    body: "See a post that's working? Hit Boost for finished variations in your voice, ready to riff on. Or expand a short post into a full essay or video script.",
    icon: Zap,
  },
  {
    eyebrow: "Chat",
    title: "Chat with any post or creator",
    body: "Open a post and ask anything: pull the transcript, break down the hook, or spin new angles. Mira keeps it grounded in the real content, not guesses.",
    icon: MessageCircle,
  },
];

const VOICE_OPTIONS: {
  mode: Exclude<VoiceMode, "menu">;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
}[] = [
  {
    mode: "chat",
    icon: Sparkles,
    eyebrow: "Recommended · ~5 min",
    title: "Build via chat",
    body: "A guided conversation excavates your mission, influences, and the patterns you already write in. The deepest version, and the right pick if you don't have a stack of writing on hand.",
    cta: "Start chat",
  },
  {
    mode: "links",
    icon: Link2,
    eyebrow: "~2 min",
    title: "Paste links of your content",
    body: "Paste up to 5 links to your videos, posts, reels, or articles. We read each one and build a voice from the actual content.",
    cta: "Paste links",
  },
  {
    mode: "archetype",
    icon: LayoutGrid,
    eyebrow: "Fastest · ~1 min",
    title: "Pick a starting point",
    body: "Six archetype voices (The Founder, The Contrarian, The Philosopher, The Operator, The Educator, The Creative). Pick one and refine from there.",
    cta: "See templates",
  },
];

export default function OnboardingFlow({
  defaultName,
  defaultWorkspaceName,
}: {
  defaultName: string;
  defaultWorkspaceName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0); // 0 = profile, 1..TOUR.length = tour, last = voice
  const [saving, setSaving] = useState(false);

  // Profile state
  const [accountType, setAccountType] = useState<"self" | "team">("self");
  const [displayName, setDisplayName] = useState(defaultName);
  const [workspaceName, setWorkspaceName] = useState(defaultWorkspaceName);
  const [building, setBuilding] = useState("");
  const [topics, setTopics] = useState("");

  // Voice handoff
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("menu");

  const VOICE_STEP = TOUR.length + 1;
  const totalSteps = TOUR.length + 2;

  async function postProfile(payload: Record<string, unknown>) {
    try {
      await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // best-effort; never block the flow
    }
  }

  async function saveProfileAndAdvance() {
    setSaving(true);
    await postProfile({
      accountType,
      displayName: displayName.trim(),
      workspaceName: workspaceName.trim(),
      building: building.trim(),
      topics: topics.trim(),
    });
    setSaving(false);
    setStep(1);
  }

  // Mark onboarding finished and close the flow. Optionally hand off to the
  // voice builder: "chat" launches the guided voice conversation; "links" /
  // "archetype" open the build-voice modal on that screen.
  async function finish(launchVoice?: Exclude<VoiceMode, "menu">) {
    setOpen(false);
    void postProfile({ complete: true });
    if (!launchVoice) return;
    if (launchVoice === "chat") {
      try {
        const res = await fetch("/api/voice/build-chat", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.chat_id) {
          router.push(`/chats/${data.chat_id}`);
          return;
        }
      } catch {
        // fall through to the modal menu
      }
      setVoiceMode("menu");
      setVoiceOpen(true);
      return;
    }
    setVoiceMode(launchVoice);
    setVoiceOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && finish()}>
        <DialogContent
          showCloseButton
          className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Set up CreatorCrew</DialogTitle>

          <AnimatePresence mode="wait">
            {/* ---------- Profile ---------- */}
            {step === 0 && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <div className="space-y-4 p-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      A few quick things
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">
                      Let&apos;s set up CreatorCrew around you.
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      This helps us address you right and keep suggestions in your
                      lane. You can change any of it later in Settings.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ToggleCard
                      active={accountType === "self"}
                      onClick={() => setAccountType("self")}
                      icon={<User className="h-4 w-4" />}
                      label="For myself"
                    />
                    <ToggleCard
                      active={accountType === "team"}
                      onClick={() => setAccountType("team")}
                      icon={<Users className="h-4 w-4" />}
                      label="For a team or brand"
                    />
                  </div>

                  <Field label="What should we call you?" required>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Your name"
                    />
                  </Field>

                  <Field label="Workspace name" required>
                    <input
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Workspace name"
                    />
                  </Field>

                  <Field label="What you're building">
                    <textarea
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="I'm building a newsletter and course about indie game design."
                    />
                  </Field>

                  <Field label="What you talk or write about">
                    <textarea
                      value={topics}
                      onChange={(e) => setTopics(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="I write about the creative process, building an audience, and psychology."
                    />
                  </Field>
                </div>

                <Footer>
                  <span />
                  <Button
                    onClick={saveProfileAndAdvance}
                    disabled={
                      saving || !displayName.trim() || !workspaceName.trim()
                    }
                  >
                    {saving ? "Saving…" : "Continue"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Footer>
              </motion.div>
            )}

            {/* ---------- Tour ---------- */}
            {step >= 1 && step <= TOUR.length && (
              <motion.div
                key={`tour-${step}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <SlideVisual icon={TOUR[step - 1].icon} />
                <div className="space-y-2 p-6">
                  <p className="text-xs font-medium text-muted-foreground">
                    {TOUR[step - 1].eyebrow}
                  </p>
                  <h2 className="text-xl font-semibold tracking-[-0.02em]">
                    {TOUR[step - 1].title}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {TOUR[step - 1].body}
                  </p>
                  <Dots total={TOUR.length} active={step - 1} />
                </div>

                <Footer>
                  <Button variant="ghost" onClick={() => setStep(step - 1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={() => setStep(step + 1)}>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Footer>
              </motion.div>
            )}

            {/* ---------- Voice ---------- */}
            {step === VOICE_STEP && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <div className="space-y-4 p-6">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <Fingerprint className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Last step · The one that matters
                      </p>
                      <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.02em]">
                        Build your voice. It&apos;s how Mira thinks like you.
                      </h2>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    A short guided session pulls out your intellectual signature:
                    the beliefs, frameworks, and patterns you can&apos;t easily see
                    in your own mind. It&apos;s what turns Mira from generic AI into
                    a tool that writes ideas only you could have.
                  </p>

                  <div className="space-y-2.5">
                    {VOICE_OPTIONS.map((opt) => (
                      <VoiceOptionCard
                        key={opt.mode}
                        opt={opt}
                        onClick={() => finish(opt.mode)}
                      />
                    ))}
                  </div>

                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    As you&apos;re chatting, you can always say{" "}
                    <span className="font-medium text-foreground">
                      &quot;update my voice&quot;
                    </span>{" "}
                    to refine it as you go.
                  </p>
                </div>

                <Footer>
                  <Button variant="ghost" onClick={() => setStep(step - 1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => {
                      toast("You can build your voice anytime from the Voice page.");
                      finish();
                    }}
                  >
                    I&apos;ll do this later
                  </Button>
                </Footer>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <BuildVoiceModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        initialMode={voiceMode}
      />
    </>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-3">
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-muted-foreground"> *</span>}
      </span>
      {children}
    </label>
  );
}

function ToggleCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SlideVisual({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative grid h-44 place-items-center overflow-hidden border-b bg-gradient-to-br from-emerald-500/10 via-muted/40 to-background">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-background shadow-sm ring-1 ring-border">
        <Icon className="h-7 w-7 text-emerald-600" />
      </div>
    </div>
  );
}

function Dots({ total, active }: { total: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5 pt-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === active ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

function VoiceOptionCard({
  opt,
  onClick,
}: {
  opt: {
    icon: React.ComponentType<{ className?: string }>;
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
  };
  onClick: () => void;
}) {
  const Icon = opt.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            {opt.eyebrow}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
            {opt.cta}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
        <div className="mt-0.5 text-sm font-semibold">{opt.title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {opt.body}
        </p>
      </div>
    </button>
  );
}
