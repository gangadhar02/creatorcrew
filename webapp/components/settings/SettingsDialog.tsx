"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  User,
  Building2,
  Users,
  SlidersHorizontal,
  Fingerprint,
  Gift,
  CreditCard,
  Camera,
  Loader2,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getTheme,
  applyTheme,
  getBoolPref,
  setBoolPref,
  getStrPref,
  setStrPref,
  PREF_KEYS,
  type ThemeMode,
} from "@/lib/prefs";

type SectionKey =
  | "profile"
  | "workspace"
  | "members"
  | "preferences"
  | "voices"
  | "affiliate"
  | "billing";

const NAV: {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "workspace", label: "Workspace", icon: Building2 },
  { key: "members", label: "Members", icon: Users },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { key: "voices", label: "Voices", icon: Fingerprint },
  { key: "affiliate", label: "Affiliate", icon: Gift },
  { key: "billing", label: "Billing", icon: CreditCard },
];

export default function SettingsDialog({
  open,
  onClose,
  workspaceName,
  workspaceEmail,
}: {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  workspaceEmail: string;
}) {
  const [section, setSection] = useState<SectionKey>("profile");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-4xl"
        style={{ height: "82vh", maxHeight: "82vh" }}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-full min-h-0">
          {/* Left nav */}
          <aside className="flex w-52 shrink-0 flex-col border-r bg-muted/30 p-3">
            <button
              onClick={onClose}
              className="mb-3 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="mb-1 px-2 text-sm font-semibold">Settings</div>
            <nav className="space-y-0.5">
              {NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.key}
                    onClick={() => setSection(n.key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      section === n.key
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {n.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
            {section === "profile" && <ProfileSection email={workspaceEmail} />}
            {section === "workspace" && (
              <WorkspaceSection name={workspaceName} email={workspaceEmail} />
            )}
            {section === "preferences" && <PreferencesSection />}
            {section === "voices" && <VoicesSection />}
            {section === "members" && (
              <Placeholder
                title="Members"
                desc="Invite teammates to your workspace."
                note="This build is single-workspace, so member management isn't available yet."
              />
            )}
            {section === "affiliate" && (
              <Placeholder
                title="Affiliate"
                desc="Earn by referring others."
                note="The affiliate program isn't available in this build."
              />
            )}
            {section === "billing" && (
              <Placeholder
                title="Billing"
                desc="Manage your plan and payment method."
                note="This build is free and unmetered, so nothing to bill."
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <div className="text-sm font-medium">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────
function ProfileSection({ email }: { email: string }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [building, setBuilding] = useState("");
  const [topics, setTopics] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState(email);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowserClient()
      .auth.getUser()
      .then((res: {
        data: {
          user: {
            email?: string | null;
            user_metadata?: Record<string, unknown>;
          } | null;
        };
      }) => {
        if (cancelled) return;
        const user = res.data.user;
        const m = (user?.user_metadata || {}) as Record<string, unknown>;
        setDisplayName((m.display_name as string) || "");
        setBuilding((m.building as string) || "");
        setTopics((m.topics as string) || "");
        setAvatarUrl((m.avatar_url as string) || null);
        if (user?.email) setAuthEmail(user.email);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        data: { display_name: displayName, building, topics, avatar_url: avatarUrl },
      });
      if (error) throw error;
      toast.success("Profile saved");
    } catch (e) {
      toast.error("Couldn't save profile", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5 MB).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");
      setAvatarUrl(data.url);
      await getSupabaseBrowserClient().auth.updateUser({
        data: { avatar_url: data.url },
      });
      toast.success("Photo updated");
    } catch (e) {
      toast.error("Upload failed", { description: String(e) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <SectionHeader title="Profile" desc="Manage your personal information." />

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl || undefined} alt="" />
            <AvatarFallback className="text-lg">
              {(displayName || authEmail || "U").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background disabled:opacity-60"
            title="Change photo"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickAvatar(f);
              e.target.value = "";
            }}
          />
        </div>
        <div>
          <div className="text-sm font-medium">Profile picture</div>
          <div className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, or GIF. Max 5 MB.
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <FieldLabel label="Display name" />
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <FieldLabel
            label="What you're building"
            hint="What you're working on or building right now. One or two sentences."
          />
          <Textarea
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="I'm building a newsletter and course about indie game design."
            rows={3}
          />
        </div>
        <div>
          <FieldLabel
            label="What you talk or write about"
            hint="The topics and ideas you post about. Helps tailor suggestions to your lane."
          />
          <Textarea
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="I write about the creative process, building an audience, and psychology."
            rows={3}
          />
        </div>
        <div>
          <FieldLabel label="Email" />
          <Input value={authEmail} disabled readOnly />
        </div>
      </div>

      <div className="mt-6">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── Workspace ────────────────────────────────────────────────────────────
function WorkspaceSection({ name, email }: { name: string; email: string }) {
  return (
    <div className="max-w-xl">
      <SectionHeader
        title="Workspace"
        desc="Details about this workspace."
      />
      <div className="space-y-5">
        <div>
          <FieldLabel label="Workspace name" />
          <Input value={name} disabled readOnly />
        </div>
        <div>
          <FieldLabel label="Owner email" />
          <Input value={email} disabled readOnly />
        </div>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        This build is single-workspace, so the name and owner are fixed.
      </p>
    </div>
  );
}

// ─── Preferences ──────────────────────────────────────────────────────────
function PreferencesSection() {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [autoClose, setAutoClose] = useState(true);
  const [spell, setSpell] = useState(true);
  const [spellLang, setSpellLang] = useState("en");
  const [confirmBoards, setConfirmBoards] = useState(true);
  const [confirmChats, setConfirmChats] = useState(true);

  useEffect(() => {
    setThemeState(getTheme());
    setAutoClose(getBoolPref(PREF_KEYS.autoCloseBrackets, true));
    setSpell(getBoolPref(PREF_KEYS.spellCheck, true));
    setSpellLang(getStrPref(PREF_KEYS.spellLang, "en"));
    setConfirmBoards(getBoolPref(PREF_KEYS.confirmDeleteBoards, true));
    setConfirmChats(getBoolPref(PREF_KEYS.confirmDeleteChats, true));
  }, []);

  function pickTheme(m: ThemeMode) {
    setThemeState(m);
    applyTheme(m);
  }

  const themeBtn = (m: ThemeMode, label: string, Icon: typeof Sun) => (
    <button
      onClick={() => pickTheme(m)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors",
        theme === m
          ? "bg-background font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <div className="max-w-2xl">
      <SectionHeader
        title="Preferences"
        desc="Customize how the app looks and feels."
      />

      <SubHeading>Appearance</SubHeading>
      <Row
        label="Theme"
        hint="Choose light, dark, or match your system preference."
      >
        <div className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5">
          {themeBtn("light", "Light", Sun)}
          {themeBtn("dark", "Dark", Moon)}
          {themeBtn("system", "System", Monitor)}
        </div>
      </Row>

      <Divider />
      <SubHeading>Editor</SubHeading>
      <Row
        label="Auto-close brackets"
        hint="Automatically insert closing brackets, parentheses, and braces when typing an opening one."
      >
        <Switch
          checked={autoClose}
          onCheckedChange={(v) => {
            setAutoClose(v);
            setBoolPref(PREF_KEYS.autoCloseBrackets, v);
          }}
        />
      </Row>
      <Row
        label="Spell check"
        hint="Underline misspellings when editing markdown documents."
      >
        <Switch
          checked={spell}
          onCheckedChange={(v) => {
            setSpell(v);
            setBoolPref(PREF_KEYS.spellCheck, v);
          }}
        />
      </Row>
      {spell && (
        <Row
          label="Spell check language"
          hint="Dictionary used when checking spelling."
          indent
        >
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5">
            {(
              [
                ["en", "English"],
                ["es", "Español"],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                onClick={() => {
                  setSpellLang(code);
                  setStrPref(PREF_KEYS.spellLang, code);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs transition-colors",
                  spellLang === code
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Row>
      )}

      <Divider />
      <SubHeading>Boards & chats</SubHeading>
      <Row
        label="Confirm before deleting boards"
        hint='Show an "Are you sure?" prompt when deleting a board.'
      >
        <Switch
          checked={confirmBoards}
          onCheckedChange={(v) => {
            setConfirmBoards(v);
            setBoolPref(PREF_KEYS.confirmDeleteBoards, v);
          }}
        />
      </Row>
      <Row
        label="Confirm before deleting chats"
        hint='Show an "Are you sure?" prompt when deleting a chat from the sidebar.'
      >
        <Switch
          checked={confirmChats}
          onCheckedChange={(v) => {
            setConfirmChats(v);
            setBoolPref(PREF_KEYS.confirmDeleteChats, v);
          }}
        />
      </Row>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-1 text-sm font-semibold text-foreground">
      {children}
    </h3>
  );
}

function Divider() {
  return <div className="my-5 border-t" />;
}

function Row({
  label,
  hint,
  indent,
  children,
}: {
  label: string;
  hint?: string;
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-6 py-2.5",
        indent && "pl-5"
      )}
    >
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && (
          <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
        )}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

// ─── Voices ───────────────────────────────────────────────────────────────
type VoiceLite = { id: string; name: string; is_default: boolean };

function VoicesSection() {
  const [loading, setLoading] = useState(true);
  const [personal, setPersonal] = useState<VoiceLite | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const ws = (data?.workspace || []) as VoiceLite[];
        setPersonal(ws.find((v) => v.is_default) || ws[0] || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-xl">
      <SectionHeader
        title="Voices"
        desc="Your writing voice, captured once. Every AI message writes from it."
      />

      <a
        href={personal ? `/voice/${personal.id}` : "/voice"}
        className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-primary/40"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
          <Fingerprint className="h-4 w-4 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {loading ? "Loading…" : personal?.name || "Personal voice"}
          </span>
          <span className="block text-xs text-muted-foreground">
            Your default. Strictly private to you.
          </span>
        </span>
        <span className="text-xs text-muted-foreground">Personal</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </a>

      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3.5 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Upgrade to add custom voices
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Personal voices are private to you. Custom voices are visible to anyone
        in this workspace, and any member can refine them (like a shared
        document).
      </p>
    </div>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────
function Placeholder({
  title,
  desc,
  note,
}: {
  title: string;
  desc: string;
  note: string;
}) {
  return (
    <div className="max-w-xl">
      <SectionHeader title={title} desc={desc} />
      <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {note}
      </div>
    </div>
  );
}
