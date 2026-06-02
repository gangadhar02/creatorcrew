import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getWorkspaceContext } from "@/lib/workspace";
import { getSupabase } from "@/lib/supabase";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import AgentationDev from "@/components/AgentationDev";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
// Fonts for the marketing landing page (scoped via .drafts-landing).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreatorCrew",
  description: "Your AI content crew: niche trends, voice, ideation, and drafts in one place.",
};

// Set `.dark` on <html> before hydration based on stored preference (or OS),
// inline so there's no flash-of-light-mode on first paint.
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    if (dark) document.documentElement.classList.add('dark');
    var sb = localStorage.getItem('eden.sidebar.collapsed:v1');
    if (sb === '1') document.documentElement.classList.add('sidebar-collapsed');
  } catch (_) {}
})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ws = await getWorkspaceContext();
  const authed = !!ws.userId;
  // Fetch workspace boards (Phase 9) + today's chats (Phase 10) for the sidebar.
  let boards: { id: string; name: string }[] = [];
  let recentChats: { id: string; title: string }[] = [];
  if (ws.workspaceId) {
    const sb = getSupabase();
    try {
      const { data } = await sb
        .from("boards")
        .select("id, name")
        .eq("workspace_id", ws.workspaceId)
        .eq("kind", "board")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(10);
      boards = (data || []) as { id: string; name: string }[];
    } catch {
      // boards table may not exist yet (pre-migration 008)
    }
    try {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data } = await sb
        .from("chats")
        .select("id, title")
        .eq("workspace_id", ws.workspaceId)
        .gte("updated_at", since.toISOString())
        .order("updated_at", { ascending: false })
        .limit(10);
      recentChats = (data || []) as { id: string; title: string }[];
    } catch {
      // chats table may not exist yet (pre-migration 009)
    }
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <TooltipProvider delay={200}>
          {authed ? (
            <div className="flex min-h-screen">
              <Sidebar
                onboardingCompleted={ws.onboardingCompleted}
                onboardingTotal={ws.onboardingTotal}
                workspaceName={ws.workspaceName}
                workspaceEmail={ws.workspaceEmail}
                boards={boards}
                recentChats={recentChats}
              />
              <main className="flex-1 min-w-0 overflow-x-hidden">
                <div className="w-full px-6 py-8 lg:px-8 lg:py-10 animate-page-in">
                  {children}
                </div>
              </main>
            </div>
          ) : (
            // Unauthenticated routes (/login, /auth/*) render bare — no
            // sidebar, no workspace shell. The proxy redirects every other
            // path to /login before it can reach this layout.
            <main className="min-h-screen animate-page-in">{children}</main>
          )}
          <Toaster richColors closeButton position="bottom-right" />
          {process.env.NODE_ENV === "development" && <AgentationDev />}
        </TooltipProvider>
      </body>
    </html>
  );
}
