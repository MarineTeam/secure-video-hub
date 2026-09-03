import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { getSessionState } from "@/lib/library.functions";
import {
  listPluginStates,
  setPluginEnabled,
  listRolePermissions,
  setRolePermission,
} from "@/lib/plugins.functions";
import { ALL_PERMISSIONS, ASSIGNABLE_ROLES, PLUGIN_GROUP_LABELS, type PluginGroup } from "@/lib/plugins/registry";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/plugins")({
  head: () => ({
    meta: [
      { title: "Modules — Marine Video Portal admin" },
      { name: "description", content: "Enable or disable optional modules and manage role permissions." },
      { property: "og:title", content: "Modules — Marine Video Portal admin" },
      { property: "og:description", content: "Enable or disable optional modules and manage role permissions." },
    ],
  }),
  component: PluginsPage,
});

function PluginsPage() {
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Modules</h1>
          <p className="text-sm text-muted-foreground">
            Turn optional features on or off. Disabling a module hides it everywhere but never deletes its data.
          </p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/admin">Back to admin</Link></Button>
      </div>
      <PluginList />
      <PermissionMatrix />
    </AppShell>
  );
}

function PluginList() {
  const qc = useQueryClient();
  const plugins = useQuery({ queryKey: ["plugin-states"], queryFn: () => listPluginStates() });
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => setPluginEnabled({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plugin-states"] });
      qc.invalidateQueries({ queryKey: ["plugin-context"] });
      toast.success("Modules updated.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (plugins.isLoading) return <div className="glass rounded-xl p-6 text-sm text-muted-foreground">Loading modules…</div>;
  if (plugins.isError) return <div className="glass rounded-xl p-6 text-sm text-destructive">Couldn't load modules.</div>;

  const items = plugins.data ?? [];
  const groups = Array.from(new Set(items.map((p) => p.group))) as PluginGroup[];

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {PLUGIN_GROUP_LABELS[g]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.filter((p) => p.group === g).map((p) => (
              <div key={p.id} className="glass flex items-start justify-between gap-3 rounded-xl p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.core && <Badge variant="secondary">Core</Badge>}
                    {!p.enabled && <Badge variant="outline">Off</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                  {p.permissions.length > 0 && (
                    <p className="mt-2 text-[11px] text-muted-foreground/80">{p.permissions.join(" · ")}</p>
                  )}
                </div>
                <Switch
                  checked={p.enabled}
                  disabled={p.core || toggle.isPending}
                  aria-label={`Toggle ${p.name}`}
                  onCheckedChange={(v) => toggle.mutate({ id: p.id, enabled: v })}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PermissionMatrix() {
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: ["role-permissions"], queryFn: () => listRolePermissions() });
  const save = useMutation({
    mutationFn: (v: { role: "staff" | "volunteer" | "member"; permission: string; granted: boolean }) =>
      setRolePermission({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["plugin-context"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const has = (role: string, permission: string) =>
    (rows.data ?? []).some((r) => r.role === role && r.permission === permission);

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Role permissions</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Administrators always have every permission. Approved members automatically get read access to enabled
        modules.
      </p>
      <div className="glass overflow-x-auto rounded-xl">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="p-3">Permission</th>
              {ASSIGNABLE_ROLES.map((r) => (
                <th key={r} className="p-3 capitalize">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((perm) => (
              <tr key={perm} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs">{perm}</td>
                {ASSIGNABLE_ROLES.map((role) => (
                  <td key={role} className="p-3">
                    <Checkbox
                      checked={has(role, perm)}
                      aria-label={`${role} ${perm}`}
                      onCheckedChange={(v) => save.mutate({ role, permission: perm, granted: !!v })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
