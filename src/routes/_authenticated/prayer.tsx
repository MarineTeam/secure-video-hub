import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import { listPrayers, createPrayer, togglePrayed, setPrayerAnswered, deletePrayer } from "@/lib/prayer.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { HandHeart, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prayer")({
  head: () => ({
    meta: [
      { title: "Prayer wall — Marine Video Portal" },
      { name: "description", content: "Share prayer requests with the church and pray for one another." },
      { property: "og:title", content: "Prayer wall — Marine Video Portal" },
      { property: "og:description", content: "Share prayer requests with the church and pray for one another." },
    ],
  }),
  component: () => (
    <PluginGate plugin="prayer">
      <PrayerPage />
    </PluginGate>
  ),
});

function PrayerPage() {
  const qc = useQueryClient();
  const { can } = usePlugins();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);

  const prayers = useQuery({ queryKey: ["prayers"], queryFn: () => listPrayers(), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["prayers"] });

  const add = useMutation({
    mutationFn: () => createPrayer({ data: { title: title.trim(), body: body.trim(), isAnonymous: anon } }),
    onSuccess: () => { setTitle(""); setBody(""); setAnon(false); refresh(); toast.success("Prayer request shared."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const pray = useMutation({
    mutationFn: (v: { id: string; on: boolean }) => togglePrayed({ data: v }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const answered = useMutation({
    mutationFn: (v: { id: string; answered: boolean }) => setPrayerAnswered({ data: v }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePrayer({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("Removed."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-bold gradient-text">Prayer wall</h1>
      <p className="mb-4 text-sm text-muted-foreground">Requests are visible to approved members only.</p>

      <div className="glass mb-6 rounded-xl p-4">
        <Input
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What can we pray for?"
          aria-label="Prayer title"
        />
        <Textarea
          value={body}
          maxLength={2000}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add any detail (optional)"
          className="mt-2"
          aria-label="Prayer detail"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={anon} onCheckedChange={(v) => setAnon(!!v)} /> Post anonymously
          </label>
          <Button disabled={title.trim().length < 3 || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? "Sharing…" : "Share request"}
          </Button>
        </div>
      </div>

      {prayers.isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
      {prayers.isError && <p className="text-sm text-destructive">Couldn't load the prayer wall.</p>}
      {prayers.data?.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
          No prayer requests yet. Be the first to share one.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(prayers.data ?? []).map((p) => (
          <article key={p.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{p.title}</h2>
              {p.answered && <Badge variant="secondary">Answered</Badge>}
            </div>
            {p.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{p.body}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {p.author} · {new Date(p.createdAt).toLocaleDateString()}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={p.iPrayed ? "default" : "outline"}
                onClick={() => pray.mutate({ id: p.id, on: !p.iPrayed })}
              >
                <HandHeart className="mr-1.5 h-4 w-4" /> {p.iPrayed ? "Praying" : "I prayed"} · {p.prayerCount}
              </Button>
              {p.isMine && (
                <Button size="sm" variant="ghost" onClick={() => answered.mutate({ id: p.id, answered: !p.answered })}>
                  {p.answered ? "Mark unanswered" : "Mark answered"}
                </Button>
              )}
              {(p.isMine || can("prayer.manage")) && (
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)} aria-label="Delete request">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
