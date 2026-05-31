"use client";

import { useState } from "react";
import { Settings, CreditCard, LogOut, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SettingsDialog from "./settings/SettingsDialog";

/**
 * Workspace switcher dropdown in the sidebar footer.
 * Single-workspace today — Settings/Billing/Sign-out wired with safe stubs.
 */
export default function WorkspaceSwitcher({
  name,
  email,
  collapsed = false,
}: {
  name: string;
  email: string;
  collapsed?: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const initial = name.slice(0, 1).toUpperCase();

  function onSettings() {
    setSettingsOpen(true);
  }

  function onBilling() {
    toast.info("Billing is disabled in this build.", {
      description: "Saves Engine is single-workspace and unmetered.",
    });
  }

  async function onSignOut() {
    if (
      typeof window === "undefined" ||
      !window.confirm("Sign out of this workspace?")
    ) {
      return;
    }
    try {
      // POST to the server route — it clears the Supabase session cookies
      // and redirects to /login. We follow manually via window.location so
      // the redirect actually takes effect from a fetch context.
      await fetch("/auth/sign-out", { method: "POST", redirect: "manual" });
      window.localStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = "/login";
  }

  const avatar = (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
      {initial}
    </span>
  );

  const trigger = (
    <button
      className={cn(
        "flex items-center transition-colors hover:bg-sidebar-accent/60",
        collapsed
          ? "sidebar-icon-btn mx-auto h-9 w-9 justify-center p-0"
          : "w-full justify-between gap-2 px-4 py-3 text-left"
      )}
      aria-label={name}
    >
      {collapsed ? (
        avatar
      ) : (
        <>
          <span className="flex min-w-0 items-center gap-2">
            {avatar}
            <span className="sidebar-workspace-meta min-w-0 flex-1">
              <span className="block truncate text-sm">{name}</span>
            </span>
          </span>
          <ChevronsUpDown className="sidebar-workspace-meta h-3 w-3 shrink-0 text-muted-foreground" />
        </>
      )}
    </button>
  );

  return (
    <>
    <div className={cn("border-t", collapsed && "sidebar-block pb-3")}>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent side="top" align={collapsed ? "center" : "start"} className="w-56">
          <div className="px-2 py-1.5">
            <div className="text-xs text-muted-foreground">{email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-1.5 text-[10px] font-mono uppercase tracking-widest">
            Workspace
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
              {initial}
            </span>
            <span className="flex-1 truncate">{name}</span>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSettings} className="gap-2">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onBilling} className="gap-2">
            <CreditCard className="h-3.5 w-3.5" />
            Billing
            <span className="ml-auto text-[10px] text-muted-foreground">
              free
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onSignOut}
            variant="destructive"
            className="gap-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <SettingsDialog
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      workspaceName={name}
      workspaceEmail={email}
    />
    </>
  );
}
