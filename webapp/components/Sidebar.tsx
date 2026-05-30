"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Home,
  Compass,
  MessageCircle,
  LayoutGrid,
  MessageSquare,
  RefreshCw,
  Search,
  Bookmark,
  Lightbulb,
  Sparkles,
  UserSearch,
  PanelLeftClose,
  PanelLeft,
  LayoutTemplate,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CommandPalette from "./CommandPalette";
import ChatRow from "./ChatRow";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import {
  isSidebarCollapsed,
  toggleSidebarCollapsed,
} from "@/lib/sidebar-state";

type SidebarProps = {
  onboardingCompleted: number;
  onboardingTotal: number;
  workspaceName: string;
  workspaceEmail: string;
  boards: { id: string; name: string }[];
  recentChats: { id: string; title: string }[];
};

const TOP_NAV: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "onboarding";
}[] = [
  { href: "/", label: "Home", icon: Home, badge: "onboarding" },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

const TOOLS_NAV: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { href: "/bookmarks", label: "Bookmarks", icon: LayoutTemplate },
  { href: "/saves", label: "Saves", icon: Bookmark },
  { href: "/ideate", label: "Ideate", icon: Lightbulb },
  { href: "/ideas", label: "Content Ideas", icon: Sparkles },
  { href: "/profiles", label: "Profile Analyzer", icon: UserSearch },
];

export default function Sidebar({
  onboardingCompleted,
  onboardingTotal,
  workspaceName,
  workspaceEmail,
  boards,
  recentChats,
}: SidebarProps) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [todayChats, setTodayChats] = useState(recentChats);

  useEffect(() => {
    setTodayChats(recentChats);
  }, [recentChats]);

  // Reflect the theme the pre-hydration script already applied to <html>.
  // Read after mount so SSR and first client render agree (no hydration warning).
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore storage failures (private mode etc.)
    }
    setIsDark(next);
  }

  useEffect(() => {
    setCollapsed(isSidebarCollapsed());

    function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ collapsed: boolean }>).detail;
      setCollapsed(detail?.collapsed ?? isSidebarCollapsed());
    }
    window.addEventListener("sidebar:toggle", onToggle);
    return () => window.removeEventListener("sidebar:toggle", onToggle);
  }, []);

  function toggleCollapsed() {
    const next = toggleSidebarCollapsed();
    setCollapsed(next);
  }

  // Global keyboard shortcuts:
  //  ⌘K / Ctrl+K  → command palette
  //  ⌘/ / Ctrl+/  → toggle sidebar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        toggleCollapsed();
      } else if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  async function runSync() {
    if (syncing) return;
    setSyncing(true);
    const t = toast.loading("Queueing sync…");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error("Sync failed", { id: t, description: data.error });
      } else {
        toast.success("Sync queued", {
          id: t,
          description: data.pid ? `pid ${data.pid}` : undefined,
        });
      }
    } catch (e) {
      toast.error("Sync failed", { id: t, description: String(e) });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <aside
        data-role="app-sidebar"
        className="sticky top-0 z-30 flex h-svh shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r bg-sidebar text-sidebar-foreground"
      >
        {/* Find or create ⌘K */}
        <div className={cn("sidebar-block pt-4 pb-2", collapsed ? "" : "px-3")}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size={collapsed ? "icon-sm" : "sm"}
                  onClick={() => setPaletteOpen(true)}
                  className={cn(
                    "sidebar-icon-btn font-normal text-muted-foreground hover:text-foreground",
                    collapsed ? "" : "w-full justify-between"
                  )}
                  aria-label="Find or create"
                >
                  {collapsed ? (
                    <Search className="h-4 w-4 shrink-0" />
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 shrink-0" />
                        <span className="sidebar-label whitespace-nowrap">
                          Find or create
                        </span>
                      </span>
                      <span className="sidebar-search-kbd flex items-center gap-0.5">
                        <kbd>⌘</kbd>
                        <kbd>K</kbd>
                      </span>
                    </>
                  )}
                </Button>
              }
            />
            {collapsed && (
              <TooltipContent side="right">Find or create (⌘K)</TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Top nav */}
        <nav className={cn("sidebar-block space-y-0.5 pb-2", collapsed ? "" : "px-3")}>
          {TOP_NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const showBadge =
              item.badge === "onboarding" &&
              onboardingCompleted < onboardingTotal;
            return (
              <NavRow
                key={item.href}
                href={item.href}
                active={active}
                collapsed={collapsed}
                icon={<Icon className="h-4 w-4 shrink-0" />}
                label={item.label}
                badge={
                  showBadge ? (
                    <Badge
                      variant="secondary"
                      className="sidebar-label h-4 px-1.5 font-mono text-[10px] tabular-nums"
                    >
                      {onboardingCompleted}/{onboardingTotal}
                    </Badge>
                  ) : null
                }
                badgeDot={showBadge}
              />
            );
          })}
        </nav>

        {/* Workspace boards */}
        <div className={cn("sidebar-block pt-3 pb-2", collapsed ? "" : "px-3")}>
          <SectionLabel collapsed={collapsed}>Boards</SectionLabel>
          <div className="space-y-0.5">
            {boards.length === 0 ? (
              !collapsed && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground italic">
                  No boards yet
                </div>
              )
            ) : (
              boards.map((b) => (
                <NavRow
                  key={b.id}
                  href={`/boards/${b.id}`}
                  active={pathname === `/boards/${b.id}`}
                  collapsed={collapsed}
                  icon={
                    collapsed ? (
                      <span className="grid h-4 w-4 place-items-center rounded-sm bg-muted text-[10px] font-semibold leading-none">
                        {b.name.slice(0, 1).toUpperCase()}
                      </span>
                    ) : (
                      <LayoutGrid className="h-4 w-4 shrink-0" />
                    )
                  }
                  label={b.name}
                />
              ))
            )}
          </div>
        </div>

        {/* Today's chats */}
        {todayChats.length > 0 && (
          <div className={cn("sidebar-block pt-3 pb-2", collapsed ? "" : "px-3")}>
            <SectionLabel collapsed={collapsed}>Today</SectionLabel>
            <div className="space-y-0.5">
              {todayChats.map((c) =>
                collapsed ? (
                  <NavRow
                    key={c.id}
                    href={`/chats/${c.id}`}
                    active={pathname === `/chats/${c.id}`}
                    collapsed={collapsed}
                    icon={<MessageSquare className="h-4 w-4 shrink-0" />}
                    label={c.title}
                  />
                ) : (
                  <ChatRow
                    key={c.id}
                    id={c.id}
                    title={c.title}
                    active={pathname === `/chats/${c.id}`}
                    showCheck={false}
                    onDeleted={(deletedId) =>
                      setTodayChats((prev) => prev.filter((x) => x.id !== deletedId))
                    }
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Tools */}
        <div className={cn("sidebar-block pt-3 pb-2", collapsed ? "" : "px-3")}>
          <SectionLabel collapsed={collapsed}>Tools</SectionLabel>
          <div className="space-y-0.5">
            {TOOLS_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavRow
                  key={item.href}
                  href={item.href}
                  active={pathname.startsWith(item.href)}
                  collapsed={collapsed}
                  icon={<Icon className="h-4 w-4 shrink-0" />}
                  label={item.label}
                  muted
                />
              );
            })}
          </div>
        </div>

        <div className="flex-1" />
        <Separator className={cn("my-2", collapsed && "w-8")} />

        {/* Collapse toggle */}
        <div className={cn("sidebar-block pb-1", collapsed ? "" : "px-3")}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size={collapsed ? "icon-sm" : "sm"}
                  onClick={toggleCollapsed}
                  className={cn(
                    "sidebar-icon-btn text-muted-foreground hover:text-foreground",
                    collapsed ? "" : "w-full justify-start gap-2"
                  )}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {collapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <>
                      <PanelLeftClose className="h-4 w-4" />
                      <span className="sidebar-label whitespace-nowrap">Collapse</span>
                    </>
                  )}
                </Button>
              }
            />
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar (⌘/)" : "Collapse sidebar (⌘/)"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Theme toggle */}
        <div className={cn("sidebar-block pb-1", collapsed ? "" : "px-3")}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size={collapsed ? "icon-sm" : "sm"}
                  onClick={toggleTheme}
                  className={cn(
                    "sidebar-icon-btn text-muted-foreground hover:text-foreground",
                    collapsed ? "" : "w-full justify-start gap-2"
                  )}
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {isDark ? (
                    <Sun className="h-4 w-4 shrink-0" />
                  ) : (
                    <Moon className="h-4 w-4 shrink-0" />
                  )}
                  {!collapsed && (
                    <span className="sidebar-label whitespace-nowrap">
                      {isDark ? "Light mode" : "Dark mode"}
                    </span>
                  )}
                </Button>
              }
            />
            <TooltipContent side="right">
              {isDark ? "Switch to light mode" : "Switch to dark mode"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Run Sync Now */}
        <div className={cn("sidebar-block pb-2", collapsed ? "" : "px-3")}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size={collapsed ? "icon-sm" : "sm"}
                  onClick={runSync}
                  disabled={syncing}
                  className={cn(
                    "sidebar-icon-btn text-muted-foreground hover:text-foreground",
                    collapsed ? "" : "w-full justify-start gap-2"
                  )}
                  aria-label="Run sync"
                >
                  <RefreshCw
                    className={cn("h-4 w-4 shrink-0", syncing && "animate-spin")}
                  />
                  {!collapsed && (
                    <span className="sidebar-sync-label whitespace-nowrap">
                      {syncing ? "Syncing…" : "Run Sync Now"}
                    </span>
                  )}
                </Button>
              }
            />
            <TooltipContent side="right">
              Runs sync.py against your IG saved feed
            </TooltipContent>
          </Tooltip>
        </div>

        <WorkspaceSwitcher
          name={workspaceName}
          email={workspaceEmail}
          collapsed={collapsed}
        />
      </aside>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

function NavRow({
  href,
  active,
  collapsed,
  icon,
  label,
  badge,
  badgeDot,
  muted,
}: {
  href: string;
  active: boolean;
  collapsed: boolean;
  icon?: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  badgeDot?: boolean;
  muted?: boolean;
}) {
  const link = (
    <div className={cn(collapsed && "flex w-full justify-center")}>
      <motion.div
        whileHover={{ x: collapsed ? 0 : 1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <Link
          href={href}
          className={cn(
            "sidebar-nav-link relative flex items-center rounded-md text-sm transition-colors",
            collapsed ? "py-0" : "justify-between px-3 py-1.5",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : muted
                ? "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
          )}
        >
          <span
            className={cn(
              "flex min-w-0 items-center",
              collapsed ? "justify-center" : "gap-2"
            )}
          >
            {icon && (
              <span
                className={cn(
                  "relative flex shrink-0 items-center justify-center",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {icon}
                {collapsed && badgeDot && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-sidebar" />
                )}
              </span>
            )}
            {!collapsed && (
              <span className="sidebar-label truncate whitespace-nowrap">{label}</span>
            )}
          </span>
          {!collapsed && badge}
        </Link>
      </motion.div>
    </div>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SectionLabel({
  children,
  collapsed,
}: {
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  if (collapsed) return null;
  return (
    <div className="sidebar-section-label px-3 mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}
