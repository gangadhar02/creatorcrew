import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // If already signed in, bounce to home (or wherever they were headed).
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sp = await searchParams;
  if (user) redirect(sp.next || "/home");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Saves Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email — we&apos;ll send you a sign-in link.
          </p>
        </header>
        <LoginForm next={sp.next} initialError={sp.error} />
      </div>
    </div>
  );
}
