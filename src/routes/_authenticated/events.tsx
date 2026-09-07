import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import { listEvents, upsertEvent, deleteEvent, rsvpEvent } from "@/lib/events.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, MapPin, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({
    meta: [
      { title: "Events — Marine Video Portal" },
      { name: "description", content: "Upcoming church events with RSVP and attendance counts." },
      { property: "og:title", content: "Events — Marine Video Portal" },
      { property: "og:description", content: "Upcoming church events with RSVP and attendance counts." },
    ],
  }),
  component: () => (
    <PluginGate plugin="events">
      <EventsPage />
    </PluginGate>
  ),
});

type EventRow = Awaited<ReturnType<typeof listEvents>>[number];

function EventsPage() {
  const qc = useQueryClient();
  const { can } = usePlugins();
  const events = useQuery({ queryKey: ["events"], queryFn: () => listEvents(), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["events"] });

  const rsvp = useMutation({
    mutationFn: (v: { eventId: string; status: "going" | "maybe" | "no" }) => rsvpEvent({ data: { ...v, guests: 0 } }),
    onSuccess: () => { refresh(); toast.success("RSVP saved."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("Event deleted."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Events</h1>
          <p className="text-sm text-muted-foreground">Everything happening at the church.</p>
        </div>
        {can("events.manage") && <EventDialog />}
      </div>

      {events.isLoading && <p className="text-sm text-muted-foreground">Loading events…</p>}
      {events.isError && <p className="text-sm text-destructive">Couldn't load events.</p>}
      {events.data?.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">No events scheduled yet.</div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(events.data ?? []).map((e) => (
          <article key={e.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{e.title}</h2>
              {!e.published && <Badge variant="outline">Draft</Badge>}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(e.starts_at).toLocaleString()}
            </p>
            {e.location && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {e.location}
              </p>
            )}
            {e.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{e.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{e.goingCount} attending</p>
            {e.rsvp_enabled && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["going", "maybe", "no"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={e.myStatus === s ? "default" : "outline"}
                    onClick={() => rsvp.mutate({ eventId: e.id, status: s })}
                  >
                    {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't make it"}
                  </Button>
                ))}
              </div>
            )}
            {can("events.manage") && (
              <div className="mt-3 flex gap-2 border-t pt-3">
                <EventDialog event={e} />
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(e.id)} aria-label="Delete event">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function EventDialog({ event }: { event?: EventRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: event?.title ?? "",
    description: event?.description ?? "",
    location: event?.location ?? "",
    startsAt: toLocalInput(event?.starts_at) || toLocalInput(new Date().toISOString()),
    endsAt: toLocalInput(event?.ends_at),
    capacity: event?.capacity?.toString() ?? "",
  });

  const save = useMutation({
    mutationFn: () =>
      upsertEvent({
        data: {
          id: event?.id,
          title: form.title.trim(),
          description: form.description || null,
          location: form.location || null,
          startsAt: form.startsAt,
          endsAt: form.endsAt || null,
          published: true,
          rsvpEnabled: true,
          capacity: form.capacity ? Number(form.capacity) : null,
        },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setOpen(false); toast.success("Event saved."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={event ? "outline" : "default"}>
          {event ? "Edit" : <><Plus className="mr-1.5 h-4 w-4" /> New event</>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Title" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Description" rows={3} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input placeholder="Location" maxLength={300} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Starts
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">Ends
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </label>
          </div>
          <Input placeholder="Capacity (optional)" inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/\D/g, "") })} />
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || form.title.trim().length < 2 || !form.startsAt} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
