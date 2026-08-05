import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { getSessionState } from "@/lib/library.functions";
import {
  listAdminVideos, syncBunnyLibrary, cleanupDeletedVideos, renameVideo, deleteVideo, setVideoCollection, createTusUpload,
  listCollections, createCollection, deleteCollection,
  listViewers, addViewers, removeViewer,
  listShares, createShare, revokeShare,
  getAllSettings, updateSetting,
  getAuditLog, getAnalytics,
} from "@/lib/admin.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PALETTES, applyPalette, paletteFromValue } from "@/lib/theme";
import { Trash2, Upload, Share2, Plus, Download, ListOrdered } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { listChapters, saveChapters } from "@/lib/chapters.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import * as tus from "tus-js-client";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

function AdminPage() {
  const session = useQuery({ queryKey: ["session-state"], queryFn: () => getSessionState() });
  if (!session.data) return <AppShell><div className="p-8 text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!session.data.isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto mt-20 max-w-lg glass rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <IdleTimeout />
      <h1 className="mb-4 text-2xl font-bold gradient-text">Admin</h1>
      <Tabs defaultValue="videos" className="w-full">
        <TabsList className="glass w-full flex-wrap">
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="viewers">Viewers</TabsTrigger>
          <TabsTrigger value="shares">Shares</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="videos"><VideosTab /></TabsContent>
        <TabsContent value="viewers"><ViewersTab /></TabsContent>
        <TabsContent value="shares"><SharesTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ---- Videos ----

function VideosTab() {
  const qc = useQueryClient();
  const videos = useQuery({ queryKey: ["admin-videos"], queryFn: () => listAdminVideos() });
  const sync = useMutation({
    mutationFn: () => syncBunnyLibrary(),
    onSuccess: (r) => { toast.success(`Synced ${r.count} videos.`); qc.invalidateQueries({ queryKey: ["admin-videos"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const cleanup = useMutation({
    mutationFn: async () => {
      const preview = await cleanupDeletedVideos({ data: { dryRun: true } });
      if (preview.orphans.length === 0) return { removed: 0 };
      const list = preview.orphans.slice(0, 10).map((o) => `• ${o.title || o.id}`).join("\n");
      const more = preview.orphans.length > 10 ? `\n…and ${preview.orphans.length - 10} more` : "";
      if (!window.confirm(`Remove ${preview.orphans.length} video(s) no longer in bunny.net?\n\n${list}${more}`)) {
        return { removed: -1 };
      }
      return cleanupDeletedVideos({ data: {} });
    },
    onSuccess: (r) => {
      if (r.removed === -1) return;
      toast.success(r.removed === 0 ? "Nothing to clean up." : `Removed ${r.removed} deleted video(s).`);
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteVideo({ data: { id } }),
    onSuccess: () => { toast.success("Deleted."); qc.invalidateQueries({ queryKey: ["admin-videos"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => renameVideo({ data: v }),
    onSuccess: () => { toast.success("Renamed."); qc.invalidateQueries({ queryKey: ["admin-videos"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const setCol = useMutation({
    mutationFn: (v: { id: string; collectionId: string | null }) => setVideoCollection({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-videos"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");

  async function onFile(file: File) {
    const title = uploadTitle.trim() || file.name.replace(/\.[^.]+$/, "");
    setUploading({ name: title, progress: 0 });
    try {
      const { video, sig } = await createTusUpload({ data: { title } });
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: sig.endpoint,
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: sig.signature,
            AuthorizationExpire: String(sig.expiration),
            VideoId: video.guid,
            LibraryId: String(sig.libraryId),
          },
          metadata: { filetype: file.type, title, filename: file.name },
          onError: reject,
          onProgress: (sent, total) => setUploading({ name: title, progress: (sent / total) * 100 }),
          onSuccess: () => resolve(),
        });
        upload.start();
      });
      toast.success("Upload complete. Encoding will finish in a moment.");
      setUploadTitle("");
      setUploading(null);
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
    } catch (e) {
      toast.error((e as Error).message);
      setUploading(null);
    }
  }

  const collections = videos.data?.collections ?? [];

  return (
    <div className="mt-4 space-y-4">
      <CollectionsSection />
      <div className="glass rounded-xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-medium">Upload</h3>
          <Button variant="ghost" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>Sync from bunny.net</Button>
          <Button variant="ghost" size="sm" onClick={() => cleanup.mutate()} disabled={cleanup.isPending}>Clean up deleted</Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label>Title (optional)</Label>
            <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Auto-derived from filename" />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md gradient-brand px-3 py-2 text-sm font-medium text-primary-foreground">
            <Upload className="h-4 w-4" /> Choose file
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
        </div>
        {uploading && (
          <div className="mt-3">
            <div className="text-xs">{uploading.name} — {Math.round(uploading.progress)}%</div>
            <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full gradient-brand rounded" style={{ width: `${uploading.progress}%` }} /></div>
          </div>
        )}
      </div>

      <div className="glass overflow-x-auto rounded-xl p-2">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="p-2">Title</th><th className="p-2">Status</th><th className="p-2">Collection</th><th className="p-2">Views</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {(videos.data?.videos ?? []).map((v) => (
              <tr key={v.id} className="border-t border-border/50">
                <td className="p-2">
                  <input
                    defaultValue={v.title}
                    className="w-full bg-transparent outline-none focus:underline"
                    onBlur={(e) => { if (e.target.value !== v.title && e.target.value.trim()) rename.mutate({ id: v.id, title: e.target.value.trim() }); }}
                  />
                </td>
                <td className="p-2 text-xs">
                  {v.status === 4 ? <span className="text-emerald-400">Ready</span> : <span className="text-amber-400">Encoding {v.encodeProgress}%</span>}
                </td>
                <td className="p-2">
                  <select
                    value={v.collectionId ?? ""}
                    onChange={(e) => setCol.mutate({ id: v.id, collectionId: e.target.value || null })}
                    className="rounded bg-muted px-2 py-1 text-xs"
                  >
                    <option value="">—</option>
                    {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="p-2 text-xs">{v.views}</td>
                <td className="p-2 text-right">
                  <ChaptersButton videoId={v.id} title={v.title} />
                  <ShareForVideoButton videoId={v.id} />
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${v.title}"?`)) del.mutate(v.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChaptersButton({ videoId, title }: { videoId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const loaded = useQuery({
    queryKey: ["admin-chapters", videoId],
    queryFn: () => listChapters({ data: { videoId } }),
    enabled: open,
  });
  useEffect(() => {
    if (loaded.data) {
      setText(
        loaded.data
          .map((c) => `${Math.floor(c.start / 60)}:${String(Math.floor(c.start % 60)).padStart(2, "0")} ${c.label}`)
          .join("\n"),
      );
    }
  }, [loaded.data]);
  const save = useMutation({
    mutationFn: () => {
      const chapters = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/^(?:(\d+):)?(\d+):(\d{1,2})\s+(.+)$/);
          if (!m) throw new Error(`Bad line: "${line}" — use "1:23 Chapter title"`);
          const start = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
          return { label: m[4]!, start };
        });
      return saveChapters({ data: { videoId, chapters } });
    },
    onSuccess: (r) => { toast.success(`Saved ${r.count} chapter(s).`); setOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Chapters">
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chapters — {title}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">One per line: <code>0:00 Intro</code></p>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"0:00 Intro\n2:15 Safety checks"} />
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-brand text-primary-foreground">Save chapters</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}


function ShareForVideoButton({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState(72);
  const m = useMutation({
    mutationFn: () => createShare({ data: { videoId, recipientEmail: email, ttlHours: hours } }),
    onSuccess: (r) => {
      const url = `${window.location.origin}/s/${r.token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Share link created and copied.");
      setOpen(false); setEmail("");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Share2 className="h-4 w-4" /></Button>;
  return (
    <div className="inline-flex items-center gap-1">
      <Input placeholder="recipient@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 w-56 text-xs" />
      <Input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="h-8 w-16 text-xs" />
      <Button size="sm" onClick={() => m.mutate()} disabled={!email || m.isPending}>Send</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>x</Button>
    </div>
  );
}

function CollectionsSection() {
  const qc = useQueryClient();
  const cols = useQuery({ queryKey: ["admin-collections"], queryFn: () => listCollections() });
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => createCollection({ data: { name } }),
    onSuccess: () => { setName(""); toast.success("Collection created."); qc.invalidateQueries({ queryKey: ["admin-collections"] }); qc.invalidateQueries({ queryKey: ["admin-videos"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteCollection({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-collections"] }); qc.invalidateQueries({ queryKey: ["admin-videos"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="mb-3 font-medium">Collections</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {(cols.data ?? []).map((c) => (
          <span key={c.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            {c.name}
            <button className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate(c.id)}><Trash2 className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" />
        <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Add</Button>
      </form>
    </div>
  );
}

// ---- Viewers ----

function ViewersTab() {
  const qc = useQueryClient();
  const viewers = useQuery({ queryKey: ["viewers"], queryFn: () => listViewers() });
  const [bulk, setBulk] = useState("");
  const add = useMutation({
    mutationFn: () => {
      const emails = bulk.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
      return addViewers({ data: { emails } });
    },
    onSuccess: (r) => { toast.success(`Added ${r.added}.`); setBulk(""); qc.invalidateQueries({ queryKey: ["viewers"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const rem = useMutation({
    mutationFn: (id: string) => removeViewer({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["viewers"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="mt-4 space-y-4">
      <div className="glass rounded-xl p-4">
        <h3 className="mb-2 font-medium">Add viewers</h3>
        <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="One or more emails, comma or newline separated" rows={3} />
        <Button className="mt-2" onClick={() => add.mutate()} disabled={!bulk.trim() || add.isPending}>Add</Button>
      </div>
      <div className="glass rounded-xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Approved viewers</h3>
          <Button
            variant="outline"
            size="sm"
            disabled={!viewers.data?.length}
            onClick={() =>
              downloadCsv(
                `approved-viewers-${new Date().toISOString().slice(0, 10)}.csv`,
                (viewers.data ?? []).map((v) => ({ email: v.email, added_at: v.added_at, last_seen_at: v.last_seen_at ?? "" })),
                ["email", "added_at", "last_seen_at"],
              )
            }
          >
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="divide-y">
          {(viewers.data ?? []).map((v) => (
            <div key={v.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div>{v.email}</div>
                <div className="text-xs text-muted-foreground">Last seen: {v.last_seen_at ? new Date(v.last_seen_at).toLocaleString() : "never"}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => rem.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {viewers.data && viewers.data.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No viewers yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ---- Shares ----

function SharesTab() {
  const qc = useQueryClient();
  const shares = useQuery({ queryKey: ["shares"], queryFn: () => listShares() });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeShare({ data: { id } }),
    onSuccess: () => { toast.success("Revoked."); qc.invalidateQueries({ queryKey: ["shares"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="mt-4 glass rounded-xl p-4">
      <h3 className="mb-3 font-medium">Share links</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr>
          <th className="p-2">Recipient</th><th className="p-2">Video</th><th className="p-2">Expires</th><th className="p-2">Status</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          {(shares.data ?? []).map((s) => {
            const status = s.revoked_at ? "revoked" : new Date(s.expires_at) < new Date() ? "expired" : s.viewed_at ? "viewed" : "sent";
            return (
              <tr key={s.id} className="border-t border-border/50">
                <td className="p-2">{s.recipient_email}</td>
                <td className="p-2 font-mono text-xs">{s.bunny_video_id.slice(0, 8)}…</td>
                <td className="p-2 text-xs">{new Date(s.expires_at).toLocaleString()}</td>
                <td className="p-2 text-xs">{status}</td>
                <td className="p-2 text-right">
                  {!s.revoked_at && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/s/${s.token}`); toast.success("Copied."); }}>Copy</Button>
                      <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>Revoke</Button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Settings ----

function SettingsTab() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getAllSettings() });
  const settingsMap = useMemo(() => {
    const m: Record<string, unknown> = {};
    for (const r of settings.data ?? []) {
      try { m[r.key] = JSON.parse(r.valueJson); } catch { m[r.key] = r.valueJson; }
    }
    return m;
  }, [settings.data]);

  const currentPalette = paletteFromValue(settingsMap.palette).name;
  const homepageCount = typeof settingsMap.homepage_video_count === "number" ? settingsMap.homepage_video_count : 24;
  const idle = typeof settingsMap.idle_timeout_minutes === "number" ? settingsMap.idle_timeout_minutes : 30;

  const upd = useMutation({
    mutationFn: (v: { key: "homepage_video_count" | "palette" | "idle_timeout_minutes"; value: unknown }) => updateSetting({ data: v }),
    onSuccess: () => { toast.success("Saved."); qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["palette"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="glass rounded-xl p-4">
        <h3 className="mb-3 font-medium">Palette</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.values(PALETTES).map((p) => (
            <button
              key={p.name}
              className={`rounded-lg border p-3 text-left ${currentPalette === p.name ? "ring-2 ring-primary" : ""}`}
              onClick={() => { applyPalette(p); upd.mutate({ key: "palette", value: p.name }); }}
            >
              <div className="mb-2 flex gap-1">
                <span className="h-6 w-6 rounded" style={{ background: p.brand }} />
                <span className="h-6 w-6 rounded" style={{ background: p.accent }} />
              </div>
              <div className="text-xs">{p.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="glass rounded-xl p-4">
        <h3 className="mb-2 font-medium">Homepage video count</h3>
        <Input type="number" min={4} max={100} defaultValue={homepageCount}
          onBlur={(e) => upd.mutate({ key: "homepage_video_count", value: Number(e.target.value) })} />
      </div>
      <div className="glass rounded-xl p-4">
        <h3 className="mb-2 font-medium">Idle timeout (minutes)</h3>
        <Input type="number" min={5} max={240} defaultValue={idle}
          onBlur={(e) => upd.mutate({ key: "idle_timeout_minutes", value: Number(e.target.value) })} />
      </div>
      <div className="glass rounded-xl p-4">
        <h3 className="mb-1 font-medium">Content protection</h3>
        <p className="text-xs text-muted-foreground">Every playback uses a fresh signed bunny.net token. Videos can't be embedded outside this portal. Share links require recipient email match and expire automatically.</p>
      </div>
    </div>
  );
}

// ---- Activity ----

function ActivityTab() {
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => getAuditLog() });
  return (
    <div className="mt-4 glass rounded-xl p-4">
      <h3 className="mb-3 font-medium">Recent activity</h3>
      <div className="divide-y text-sm">
        {(audit.data ?? []).map((a) => (
          <div key={a.id} className="py-2">
            <div className="flex justify-between gap-2">
              <span><span className="font-medium">{a.actor_email}</span> — {a.action}{a.target ? ` · ${a.target}` : ""}</span>
              <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Analytics ----

function AnalyticsTab() {
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: () => getAnalytics() });
  const a = analytics.data;
  if (!a) return <div className="mt-4 text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Videos" value={a.videoCount} />
        <Stat label="Total views" value={a.totalViews} />
        <Stat label="Watch time (hrs)" value={Math.round(a.totalWatchSeconds / 3600)} />
        <Stat label="Engagement" value={a.engagement} />
      </div>
      <div className="glass rounded-xl p-4">
        <h3 className="mb-3 font-medium">Views — last 30 days</h3>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={a.chart}>
              <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => d.slice(5)} />
              <YAxis fontSize={10} />
              <Tooltip contentStyle={{ background: "rgba(30,30,40,0.9)", border: "none", borderRadius: 8 }} />
              <Line type="monotone" dataKey="views" stroke="var(--brand)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="glass rounded-xl p-4">
        <h3 className="mb-3 font-medium">Most-watched</h3>
        <div className="divide-y text-sm">
          {a.most.map((m) => (
            <div key={m.id} className="flex justify-between py-1.5">
              <span className="line-clamp-1">{m.title}</span>
              <span className="text-xs text-muted-foreground">{m.views} views</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold gradient-text">{value}</div>
    </div>
  );
}
