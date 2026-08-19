import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { getMyProfile, upsertMyProfile } from "@/lib/profile.functions";
import { listMyShares, revokeMyShare } from "@/lib/share.functions";
import { listNotifications, markNotificationsRead } from "@/lib/social.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import { useDeviceSettings, applyThemeMode, type ThemeMode } from "@/lib/device-settings";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, Download, Link2, Monitor, Trash2, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Your profile — Marine Video Portal" },
      { name: "description", content: "Manage your profile, inbox, shared links and per-device playback settings." },
      { property: "og:title", content: "Your profile — Marine Video Portal" },
      { property: "og:description", content: "Manage your profile, inbox, shared links and per-device playback settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ProfilePage() {
  return (
    <AppShell>
      <IdleTimeout />
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold gradient-text">Your profile</h1>
        <Tabs defaultValue="profile">
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile"><User className="mr-1.5 h-4 w-4" /> Profile</TabsTrigger>
            <TabsTrigger value="inbox"><Bell className="mr-1.5 h-4 w-4" /> Inbox</TabsTrigger>
            <TabsTrigger value="shares"><Link2 className="mr-1.5 h-4 w-4" /> Shared links</TabsTrigger>
            <TabsTrigger value="settings"><Monitor className="mr-1.5 h-4 w-4" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="profile"><ProfileTab /></TabsContent>
          <TabsContent value="inbox"><InboxTab /></TabsContent>
          <TabsContent value="shares"><SharesTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProfileTab() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => getMyProfile(), retry: false });
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name ?? "");
    setAvatarUrl(profile.data.avatar_url ?? "");
    setBio(profile.data.bio ?? "");
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => upsertMyProfile({ data: { display_name: displayName, avatar_url: avatarUrl, bio } }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["comments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (displayName || profile.data?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="glass mt-4 space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your avatar" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="text-sm text-muted-foreground">{profile.data?.email}</div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Display name</Label>
        <Input id="display-name" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} placeholder="How others see you on comments" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="avatar-url">Avatar image URL</Label>
        <Input id="avatar-url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" value={bio} maxLength={500} rows={3} onChange={(e) => setBio(e.target.value)} placeholder="A short line about you" />
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>Save profile</Button>
    </div>
  );
}

function InboxTab() {
  const qc = useQueryClient();
  const notifications = useQuery({ queryKey: ["notif-list"], queryFn: () => listNotifications(), retry: false });
  const markAll = useMutation({
    mutationFn: () => markNotificationsRead({ data: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-list"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });
  const items = notifications.data ?? [];

  return (
    <div className="mt-4 space-y-4">
      <div className="glass rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Notifications</h2>
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>Mark all read</Button>
        </div>
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing new right now.</p>}
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="rounded-lg border border-border/50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                </div>
                {!n.read_at && <Badge variant="secondary">New</Badge>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 font-medium"><Download className="h-4 w-4" /> Downloads</div>
        <p className="mt-1 text-sm text-muted-foreground">Offline downloads are coming soon. Your download preferences are already saved under Settings.</p>
      </div>
    </div>
  );
}

function SharesTab() {
  const qc = useQueryClient();
  const shares = useQuery({ queryKey: ["my-shares"], queryFn: () => listMyShares(), retry: false });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeMyShare({ data: { id } }),
    onSuccess: () => { toast.success("Revoked."); qc.invalidateQueries({ queryKey: ["my-shares"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = shares.data ?? [];

  return (
    <div className="glass mt-4 rounded-xl p-5">
      <h2 className="mb-3 font-medium">Links you shared</h2>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">You haven't shared any links yet.</p>}
      <ul className="space-y-2">
        {rows.map((s) => {
          const expired = new Date(s.expiresAt) < new Date();
          const status = s.revokedAt ? "revoked" : expired ? "expired" : s.viewedAt ? "viewed" : "active";
          return (
            <li key={s.id} className="rounded-lg border border-border/50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{s.label || s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.accessMode === "public" ? "Public link" : s.recipientEmail} · expires {new Date(s.expiresAt).toLocaleDateString()} · {s.viewCount} view{s.viewCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.hasPassword && <Badge variant="secondary">Password</Badge>}
                  <Badge variant={status === "active" || status === "viewed" ? "default" : "secondary"}>{status}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/s/${s.token}`); toast.success("Copied"); }}
                  >Copy</Button>
                  {!s.revokedAt && (
                    <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>Revoke</Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SettingsTab() {
  const router = useRouter();
  const { settings, update, ready } = useDeviceSettings();
  const del = useMutation({
    mutationFn: () => deleteMyAccount({ data: { confirm: "DELETE" } }),
    onSuccess: async () => {
      await supabase.auth.signOut();
      toast.success("Account deleted.");
      router.navigate({ to: "/auth", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="glass space-y-4 rounded-xl p-5">
        <div>
          <h2 className="font-medium">Appearance</h2>
          <p className="text-xs text-muted-foreground">These settings apply to this device only.</p>
        </div>
        <Row label="Theme">
          <Select
            value={settings.themeMode}
            onValueChange={(v) => { update({ themeMode: v as ThemeMode }); applyThemeMode(v as ThemeMode); }}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Language" hint="More languages coming soon">
          <Select value={settings.language} onValueChange={(v) => update({ language: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem></SelectContent>
          </Select>
        </Row>
      </div>

      <div className="glass space-y-4 rounded-xl p-5">
        <h2 className="font-medium">Playback</h2>
        <Row label="Autoplay next video">
          <Switch checked={settings.autoplayNext} onCheckedChange={(v) => update({ autoplayNext: v })} disabled={!ready} />
        </Row>
        <Row label="Default playback speed">
          <Select value={String(settings.defaultPlaybackRate)} onValueChange={(v) => update({ defaultPlaybackRate: Number(v) })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                <SelectItem key={r} value={String(r)}>{r}×</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </div>

      <div className="glass space-y-4 rounded-xl p-5">
        <div>
          <h2 className="font-medium">Downloads</h2>
          <p className="text-xs text-muted-foreground">Offline playback is coming soon — preferences are saved now.</p>
        </div>
        <Row label="Download on Wi-Fi only">
          <Switch checked={settings.downloadOnWifiOnly} onCheckedChange={(v) => update({ downloadOnWifiOnly: v })} disabled={!ready} />
        </Row>
        <Row label="Download quality">
          <Select value={settings.downloadQuality} onValueChange={(v) => update({ downloadQuality: v as "auto" | "720p" | "1080p" })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Manage downloads">
          <Button variant="secondary" size="sm" disabled>No downloads yet</Button>
        </Row>
      </div>

      <div className="glass space-y-3 rounded-xl border-destructive/30 p-5">
        <h2 className="font-medium text-destructive">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting your account removes your profile, playlists, history, comments and revokes every link you shared. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm"><Trash2 className="mr-1.5 h-4 w-4" /> Delete account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your account and all associated activity. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()} disabled={del.isPending}>Delete permanently</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
