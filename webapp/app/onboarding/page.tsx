import OnboardingHandlesForm from "@/components/OnboardingHandlesForm";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Saves Engine
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A two-minute setup so Discover has data on day one.
        </p>
      </header>
      <OnboardingHandlesForm />
    </div>
  );
}
