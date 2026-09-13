import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import { listGroups, upsertGroup, deleteGroup, toggleGroupMembership } from "@/lib/groups.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, UsersRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({
    meta: [
      { title: "Small groups — Marine Video Portal" },
      { name: "description", content: "Find and join a small group, or lead one for the church." },
      { property: "og:title", content: "Small groups — Marine Video Portal" },
      { property: "og:description", content: "Find and join a small group, or lead one for the church." },
    ],
  }),
  component: () => (
    <PluginGate plugin="groups">
      <GroupsPage />
    </PluginGate>
  ),
});

type GroupRow = Awaited<ReturnType<typeof listGroups>>[number];

function GroupsPage() {
  const qc = useQueryClient();
  const { can } = usePlugins();
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => listGroups(), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["groups"] });

  const join = useMutation({
    mutationFn: (v: { groupId: string; join: boolean }) => toggleGroupMembership({ data: v }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteGroup({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("Group removed."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Small groups</h1>
          <p className="text-sm text-muted-foreground">Community groups you can join.</p>
        </div>
        {can("groups.manage") && <GroupDialog />}
      </div>

      {groups.isLoading && <p className="text-sm text-muted-foreground">Loading groups…</p>}
      {groups.isError && <p className="text-sm text-destructive">Couldn't load groups.</p>}
      {groups.data?.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">No groups listed yet.</div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(groups.data ?? []).map((g) => (
          <article key={g.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{g.name}</h2>
              {!g.is_open && <Badge variant="outline">Closed</Badge>}
            </div>
            {g.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{g.description}</p>}
            {g.meeting_info && <p className="mt-2 text-xs text-muted-foreground">{g.meeting_info}</p>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UsersRound className="h-3.5 w-3.5" /> {g.memberCount} members
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={g.isMember ? "outline" : "default"}
                disabled={!g.is_open && !g.isMember}
                onClick={() => join.mutate({ groupId: g.id, join: !g.isMember })}
              >
                {g.isMember ? "Leave group" : "Join group"}
              </Button>
              {(g.isLeader || can("groups.manage")) && <GroupDialog group={g} />}
              {can("groups.manage") && (
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(g.id)} aria-label="Delete group">
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

function GroupDialog({ group }: { group?: GroupRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: group?.name ?? "",
    description: group?.description ?? "",
    meetingInfo: group?.meeting_info ?? "",
    isOpen: group?.is_open ?? true,
  });

  const save = useMutation({
    mutationFn: () =>
      upsertGroup({
        data: {
          id: group?.id,
          name: form.name.trim(),
          description: form.description || null,
          meetingInfo: form.meetingInfo || null,
          isOpen: form.isOpen,
        },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); setOpen(false); toast.success("Group saved."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={group ? "outline" : "default"}>
          {group ? "Edit" : <><Plus className="mr-1.5 h-4 w-4" /> New group</>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{group ? "Edit group" : "New group"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Group name" maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea placeholder="Description" rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input placeholder="When and where it meets" maxLength={500} value={form.meetingInfo} onChange={(e) => setForm({ ...form, meetingInfo: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.isOpen} onCheckedChange={(v) => setForm({ ...form, isOpen: !!v })} /> Open to new members
          </label>
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || form.name.trim().length < 2} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
