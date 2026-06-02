import Link from "next/link";
import { getWorkspaceContext } from "@/lib/workspace";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import SetPasswordCard from "@/components/SetPasswordCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ws = await getWorkspaceContext();

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Workspace and account configuration.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Workspace
        </h2>
        <Card className="p-4">
          <div className="grid gap-3">
            <Row label="Name" value={ws.workspaceName} />
            <Row label="Owner email" value={ws.workspaceEmail || "—"} />
            <Row label="ID" value={ws.workspaceId || "—"} />
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Account
        </h2>
        <SetPasswordCard />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Voice & content
        </h2>
        <div className="grid gap-2">
          <LinkRow href="/voice" label="Voice library" />
          <LinkRow href="/creators" label="Creators & lists" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Billing
        </h2>
        <Card className="p-4 text-sm text-muted-foreground">
          CreatorCrew is single-workspace and unmetered. No billing.
        </Card>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:border-primary/40"
    >
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
