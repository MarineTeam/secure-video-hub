import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import { listHymns, upsertHymn, deleteHymn } from "@/lib/hymnal.functions";
import { useLang, pick } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hymnal")({
  head: () => ({
    meta: [
      { title: "Hymnal — Marine Video Portal" },
      { name: "description", content: "Searchable hymn lyrics with optional Spanish translations and audio." },
      { property: "og:title", content: "Hymnal — Marine Video Portal" },
      { property: "og:description", content: "Searchable hymn lyrics with optional Spanish translations and audio." },
    ],
  }),
  component: () => (
    <PluginGate plugin="hymnal">
      <HymnalPage />
    </PluginGate>
  ),
});

function HymnalPage() {
  const [q, setQ] = useState("");
  const lang = useLang();
  const { can } = usePlugins();
  const qc = useQueryClient();
  const hymns = useQuery({ queryKey: ["hymns", q], queryFn: () => listHymns({ data: { q } }), retry: false });
  const remove = useMutation({
    mutationFn: (id: string) => deleteHymn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hymns"] }); toast.success("Hymn removed."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Hymnal</h1>
          <p className="text-sm text-muted-foreground">Search hymns by title, author or category.</p>
        </div>
        {can("hymnal.manage") && <HymnDialog />}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search hymns…"
        maxLength={100}
        className="mb-4 max-w-sm"
        aria-label="Search hymns"
      />

      {hymns.isLoading && <p className="text-sm text-muted-foreground">Loading hymns…</p>}
      {hymns.isError && <p className="text-sm text-destructive">Couldn't load the hymnal.</p>}
      {hymns.data?.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
          No hymns yet{q ? " for that search" : ""}.
        </div>
      )}

      <Accordion type="single" collapsible className="glass rounded-xl px-4">
        {(hymns.data ?? []).map((h) => (
          <AccordionItem key={h.id} value={h.id}>
            <AccordionTrigger className="text-left">
              <span className="flex min-w-0 items-center gap-3">
                {h.number != null && <span className="text-xs text-muted-foreground">#{h.number}</span>}
                <span className="truncate">{pick(lang, h.title, h.title_es)}</span>
                {h.category && <span className="hidden text-xs text-muted-foreground sm:inline">{h.category}</span>}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {h.author && <p className="mb-2 text-xs text-muted-foreground">{h.author}</p>}
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {pick(lang, h.lyrics, h.lyrics_es)}
              </pre>
              {h.audio_url && (
                <audio controls src={h.audio_url} className="mt-3 w-full">
                  <track kind="captions" />
                </audio>
              )}
              {can("hymnal.manage") && (
                <div className="mt-3 flex gap-2">
                  <HymnDialog hymn={h} />
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(h.id)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </AppShell>
  );
}

type HymnRow = Awaited<ReturnType<typeof listHymns>>[number];

function HymnDialog({ hymn }: { hymn?: HymnRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    number: hymn?.number?.toString() ?? "",
    title: hymn?.title ?? "",
    titleEs: hymn?.title_es ?? "",
    author: hymn?.author ?? "",
    category: hymn?.category ?? "",
    lyrics: hymn?.lyrics ?? "",
    lyricsEs: hymn?.lyrics_es ?? "",
    audioUrl: hymn?.audio_url ?? "",
  });

  const save = useMutation({
    mutationFn: () =>
      upsertHymn({
        data: {
          id: hymn?.id,
          number: form.number ? Number(form.number) : null,
          title: form.title,
          titleEs: form.titleEs || null,
          author: form.author || null,
          category: form.category || null,
          lyrics: form.lyrics,
          lyricsEs: form.lyricsEs || null,
          audioUrl: form.audioUrl || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hymns"] });
      setOpen(false);
      toast.success("Hymn saved.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={hymn ? "outline" : "default"}>
          {hymn ? "Edit" : <><Plus className="mr-1.5 h-4 w-4" /> Add hymn</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{hymn ? "Edit hymn" : "Add hymn"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Number" inputMode="numeric" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.replace(/\D/g, "") })} />
            <Input placeholder="Category" maxLength={100} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <Input placeholder="Title" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Título (Spanish)" maxLength={200} value={form.titleEs} onChange={(e) => setForm({ ...form, titleEs: e.target.value })} />
          <Input placeholder="Author" maxLength={200} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          <Textarea placeholder="Lyrics" rows={8} value={form.lyrics} onChange={(e) => setForm({ ...form, lyrics: e.target.value })} />
          <Textarea placeholder="Letra (Spanish)" rows={6} value={form.lyricsEs} onChange={(e) => setForm({ ...form, lyricsEs: e.target.value })} />
          <Input placeholder="Audio URL (optional)" value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} />
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || form.title.trim().length < 1} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
