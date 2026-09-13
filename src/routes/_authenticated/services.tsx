import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import {
  listServicePlans,
  getServicePlan,
  upsertServicePlan,
  deleteServicePlan,
  addServiceItem,
  removeServiceItem,
  moveServiceItem,
} from "@/lib/services.functions";
import { listHymns } from "@/lib/hymnal.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "Service planning — Marine Video Portal" },
      { name: "description", content: "Plan service orders with songs, readings, hymns and timings." },
      { property: "og:title", content: "Service planning — Marine Video Portal" },
      { property: "og:description", content: "Plan service orders with songs, readings, hymns and timings." },
    ],
  }),
  component: () => (
    <PluginGate plugin="services">
      <ServicesPage />
    </PluginGate>
  ),
});

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ServicesPage() {
  const qc = useQueryClient();
  const { can } = usePlugins();
  const [selected, setSelected] = useState<string | null>(null);
  const plans = useQuery({ queryKey: ["service-plans"], queryFn: () => listServicePlans(), retry: false });
  const remove = useMutation({
    mutationFn: (id: string) => deleteServicePlan({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-plans"] }); setSelected(null); toast.success("Plan deleted."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Service planning</h1>
          <p className="text-sm text-muted-foreground">Build the order of service and share it with the team.</p>
        </div>
        {can("services.manage") && <PlanDialog />}
      </div>

      {plans.isLoading && <p className="text-sm text-muted-foreground">Loading plans…</p>}
      {plans.isError && <p className="text-sm text-destructive">Couldn't load service plans.</p>}
      {plans.data?.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">No service plans yet.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {(plans.data ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`glass w-full rounded-xl p-3 text-left transition ${selected === p.id ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{p.title}</span>
                {!p.published && <Badge variant="outline">Draft</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(p.service_date).toLocaleString()}</span>
            </button>
          ))}
        </div>

        {selected ? (
          <PlanDetail id={selected} onDeleted={() => remove.mutate(selected)} canManage={can("services.manage")} />
        ) : (
          <div className="glass hidden rounded-xl p-8 text-center text-sm text-muted-foreground lg:block">
            Select a service to see its order.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PlanDetail({ id, onDeleted, canManage }: { id: string; onDeleted: () => void; canManage: boolean }) {
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ["service-plan", id], queryFn: () => getServicePlan({ data: { id } }), retry: false });
  const hymns = useQuery({ queryKey: ["hymns", ""], queryFn: () => listHymns({ data: {} }), enabled: canManage, retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["service-plan", id] });

  const [item, setItem] = useState({ kind: "item", title: "", detail: "", duration: "", hymnId: "" });

  const add = useMutation({
    mutationFn: () =>
      addServiceItem({
        data: {
          planId: id,
          kind: item.kind as "song" | "hymn" | "reading" | "sermon" | "prayer" | "video" | "item",
          title: item.title.trim(),
          detail: item.detail || null,
          durationMinutes: item.duration ? Number(item.duration) : null,
          hymnId: item.hymnId || null,
        },
      }),
    onSuccess: () => { setItem({ kind: "item", title: "", detail: "", duration: "", hymnId: "" }); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (itemId: string) => removeServiceItem({ data: { id: itemId } }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const move = useMutation({
    mutationFn: (ids: string[]) => moveServiceItem({ data: { planId: id, orderedIds: ids } }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  if (plan.isLoading) return <div className="glass rounded-xl p-6 text-sm text-muted-foreground">Loading plan…</div>;
  if (plan.isError || !plan.data) return <div className="glass rounded-xl p-6 text-sm text-destructive">Couldn't load this plan.</div>;

  const items = plan.data.items;
  const reorder = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    move.mutate(next.map((i) => i.id));
  };
  const total = items.reduce((n, i) => n + (i.duration_minutes ?? 0), 0);

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{plan.data.plan.title}</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(plan.data.plan.service_date).toLocaleString()} · {total} min planned
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <PlanDialog plan={plan.data.plan} />
            <Button size="sm" variant="ghost" onClick={onDeleted} aria-label="Delete plan"><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
      {plan.data.plan.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{plan.data.plan.notes}</p>}

      <ol className="mt-4 space-y-2">
        {items.length === 0 && <li className="text-sm text-muted-foreground">No items yet.</li>}
        {items.map((it, idx) => (
          <li key={it.id} className="flex items-center gap-2 rounded-lg border p-2">
            <span className="w-6 text-center text-xs text-muted-foreground">{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{it.title}</span>
                <Badge variant="secondary" className="capitalize">{it.kind}</Badge>
                {it.duration_minutes != null && <span className="text-xs text-muted-foreground">{it.duration_minutes} min</span>}
              </div>
              {it.detail && <p className="truncate text-xs text-muted-foreground">{it.detail}</p>}
            </div>
            {canManage && (
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => reorder(idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => reorder(idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Remove item" onClick={() => del.mutate(it.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {canManage && (
        <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[140px_1fr_100px_auto]">
          <Select value={item.kind} onValueChange={(v) => setItem({ ...item, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["item", "song", "hymn", "reading", "sermon", "prayer", "video"].map((k) => (
                <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {item.kind === "hymn" ? (
            <Select
              value={item.hymnId}
              onValueChange={(v) => {
                const h = (hymns.data ?? []).find((x) => x.id === v);
                setItem({ ...item, hymnId: v, title: h?.title ?? item.title });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choose a hymn" /></SelectTrigger>
              <SelectContent>
                {(hymns.data ?? []).map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.number ? `#${h.number} ` : ""}{h.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input placeholder="Item title" maxLength={200} value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />
          )}
          <Input placeholder="Min" inputMode="numeric" value={item.duration} onChange={(e) => setItem({ ...item, duration: e.target.value.replace(/\D/g, "") })} />
          <Button disabled={add.isPending || item.title.trim().length < 1} onClick={() => add.mutate()}>
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

type Plan = { id: string; title: string; service_date: string; notes: string | null; published: boolean };

function PlanDialog({ plan }: { plan?: Plan }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: plan?.title ?? "",
    serviceDate: toLocalInput(plan?.service_date) || toLocalInput(new Date().toISOString()),
    notes: plan?.notes ?? "",
    published: plan?.published ?? false,
  });

  const save = useMutation({
    mutationFn: () =>
      upsertServicePlan({
        data: { id: plan?.id, title: form.title.trim(), serviceDate: form.serviceDate, notes: form.notes || null, published: form.published },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-plans"] });
      if (plan) qc.invalidateQueries({ queryKey: ["service-plan", plan.id] });
      setOpen(false);
      toast.success("Service plan saved.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={plan ? "outline" : "default"}>
          {plan ? "Edit" : <><Plus className="mr-1.5 h-4 w-4" /> New service</>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Title" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs text-muted-foreground">Date and time
            <Input type="datetime-local" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />
          </label>
          <Textarea placeholder="Notes for the team" rows={3} maxLength={4000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: !!v })} /> Visible to all members
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
