import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import { listAnnouncements, upsertAnnouncement, deleteAnnouncement } from "@/lib/announcements.functions";
import { useLang, pick } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pin, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Marine Video Portal" },
      { name: "description", content: "Church announcements and notices for members." },
      { property: "og:title", content: "Announcements — Marine Video Portal" },
      { property: "og:description", content: "Church announcements and notices for members." },
    ],
  }),
  component: () => (
    <PluginGate plugin="announcements">
      <AnnouncementsPage />
    </PluginGate>
  ),
});

type Row = Awaited<ReturnType<typeof listAnnouncements>>[number];

function AnnouncementsPage() {
  const qc = useQueryClient();
  const lang = useLang();
  const { can } = usePlugins();
  const rows = useQuery({
    queryKey: ["announcements"],
    queryFn: () => listAnnouncements({ data: { tvOnly: false } }),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAnnouncement({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Deleted."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Announcements</h1>
          <p className="text-sm text-muted-foreground">Current notices for the church family.</p>
        </div>
        {can("announcements.manage") && <AnnouncementDialog />}
      </div>

      {rows.isLoading && <p className="text-sm text-muted-foreground">Loading announcements…</p>}
      {rows.isError && <p className="text-sm text-destructive">Couldn't load announcements.</p>}
      {rows.data?.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">Nothing posted right now.</div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(rows.data ?? []).map((a) => (
          <article key={a.id} className="glass overflow-hidden rounded-xl">
            {a.image_url && <img src={a.image_url} alt="" className="h-40 w-full object-cover" loading="lazy" />}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{a.title}</h2>
                {a.pinned && <Badge variant="secondary"><Pin className="mr-1 h-3 w-3" /> Pinned</Badge>}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{pick(lang, a.body, a.body_es)}</p>
              {can("announcements.manage") && (
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <AnnouncementDialog row={a} />
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function AnnouncementDialog({ row }: { row?: Row }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: row?.title ?? "",
    body: row?.body ?? "",
    bodyEs: row?.body_es ?? "",
    imageUrl: row?.image_url ?? "",
    startsAt: toLocalInput(row?.starts_at) || toLocalInput(new Date().toISOString()),
    endsAt: toLocalInput(row?.ends_at),
    pinned: row?.pinned ?? false,
    showOnTv: row?.show_on_tv ?? true,
  });

  const save = useMutation({
    mutationFn: () =>
      upsertAnnouncement({
        data: {
          id: row?.id,
          title: form.title.trim(),
          body: form.body,
          bodyEs: form.bodyEs || null,
          imageUrl: form.imageUrl || null,
          startsAt: form.startsAt,
          endsAt: form.endsAt || null,
          pinned: form.pinned,
          showOnTv: form.showOnTv,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setOpen(false);
      toast.success("Announcement saved.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={row ? "outline" : "default"}>
          {row ? "Edit" : <><Plus className="mr-1.5 h-4 w-4" /> New announcement</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{row ? "Edit announcement" : "New announcement"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Title" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Message" rows={4} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Textarea placeholder="Mensaje (Spanish)" rows={3} maxLength={4000} value={form.bodyEs} onChange={(e) => setForm({ ...form, bodyEs: e.target.value })} />
          <Input placeholder="Image URL (optional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Show from
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">Hide after
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: !!v })} /> Pin to top
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.showOnTv} onCheckedChange={(v) => setForm({ ...form, showOnTv: !!v })} /> Show on lobby TV
          </label>
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || form.title.trim().length < 2} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
