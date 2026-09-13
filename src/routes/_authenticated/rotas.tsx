import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import {
  listRotas,
  upsertRotaRole,
  deleteRotaRole,
  upsertAssignment,
  deleteAssignment,
  respondToAssignment,
} from "@/lib/rotas.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rotas")({
  head: () => ({
    meta: [
      { title: "Serving rotas — Marine Video Portal" },
      { name: "description", content: "Serving schedules and team assignments with accept or decline responses." },
      { property: "og:title", content: "Serving rotas — Marine Video Portal" },
      { property: "og:description", content: "Serving schedules and team assignments with accept or decline responses." },
    ],
  }),
  component: () => (
    <PluginGate plugin="rotas">
      <RotasPage />
    </PluginGate>
  ),
});

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function RotasPage() {
  const qc = useQueryClient();
  const { can } = usePlugins();
  const manage = can("rotas.manage");
  const rotas = useQuery({ queryKey: ["rotas"], queryFn: () => listRotas(), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["rotas"] });

  const [roleName, setRoleName] = useState("");
  const [assign, setAssign] = useState({ roleId: "", serveDate: toLocalInput(new Date().toISOString()), personName: "" });

  const addRole = useMutation({
    mutationFn: () => upsertRotaRole({ data: { name: roleName.trim() } }),
    onSuccess: () => { setRoleName(""); refresh(); toast.success("Role added."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delRole = useMutation({
    mutationFn: (id: string) => deleteRotaRole({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("Role removed."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const addAssignment = useMutation({
    mutationFn: () =>
      upsertAssignment({
        data: { roleId: assign.roleId, serveDate: assign.serveDate, personName: assign.personName.trim() || null },
      }),
    onSuccess: () => { setAssign({ ...assign, personName: "" }); refresh(); toast.success("Assignment saved."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delAssignment = useMutation({
    mutationFn: (id: string) => deleteAssignment({ data: { id } }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const respond = useMutation({
    mutationFn: (v: { id: string; status: "accepted" | "declined" }) => respondToAssignment({ data: v }),
    onSuccess: () => { refresh(); toast.success("Response saved."); },
    onError: (e) => toast.error((e as Error).message),
  });

  const roles = rotas.data?.roles ?? [];
  const assignments = rotas.data?.assignments ?? [];
  const roleName_ = (id: string) => roles.find((r) => r.id === id)?.name ?? "Role";

  return (
    <AppShell>
      <h1 className="text-2xl font-bold gradient-text">Serving rotas</h1>
      <p className="mb-4 text-sm text-muted-foreground">Who is serving, and when.</p>

      {rotas.isLoading && <p className="text-sm text-muted-foreground">Loading rotas…</p>}
      {rotas.isError && <p className="text-sm text-destructive">Couldn't load the rota.</p>}

      {manage && (
        <div className="glass mb-6 grid gap-4 rounded-xl p-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-medium">Roles</h2>
            <div className="flex gap-2">
              <Input placeholder="e.g. Sound desk" maxLength={100} value={roleName} onChange={(e) => setRoleName(e.target.value)} />
              <Button disabled={roleName.trim().length < 2 || addRole.isPending} onClick={() => addRole.mutate()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((r) => (
                <Badge key={r.id} variant="secondary" className="gap-1">
                  {r.name}
                  <button onClick={() => delRole.mutate(r.id)} aria-label={`Remove ${r.name}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">Add an assignment</h2>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Select value={assign.roleId} onValueChange={(v) => setAssign({ ...assign, roleId: v })}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="datetime-local" value={assign.serveDate} onChange={(e) => setAssign({ ...assign, serveDate: e.target.value })} />
              <Input placeholder="Person" maxLength={150} value={assign.personName} onChange={(e) => setAssign({ ...assign, personName: e.target.value })} />
            </div>
            <Button
              className="mt-2"
              disabled={!assign.roleId || !assign.serveDate || addAssignment.isPending}
              onClick={() => addAssignment.mutate()}
            >
              Add assignment
            </Button>
          </div>
        </div>
      )}

      {assignments.length === 0 && !rotas.isLoading && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">Nothing scheduled yet.</div>
      )}

      <div className="space-y-2">
        {assignments.map((a) => (
          <div key={a.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{roleName_(a.role_id)} — {a.who}</p>
              <p className="text-xs text-muted-foreground">{new Date(a.serve_date).toLocaleString()}</p>
            </div>
            <Badge variant={a.status === "accepted" ? "default" : a.status === "declined" ? "destructive" : "secondary"}>
              {a.status}
            </Badge>
            {a.isMine && a.status === "pending" && (
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => respond.mutate({ id: a.id, status: "accepted" })}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: a.id, status: "declined" })}>Decline</Button>
              </div>
            )}
            {manage && (
              <Button size="icon" variant="ghost" aria-label="Remove assignment" onClick={() => delAssignment.mutate(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
