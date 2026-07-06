import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { listSubscriptions, toggleSubscription } from "@/lib/social.functions";
import { listCollectionsForViewer } from "@/lib/library.functions";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/subscriptions")({ component: SubsPage });

function SubsPage() {
  const qc = useQueryClient();
  const subs = useQuery({ queryKey: ["subs"], queryFn: () => listSubscriptions() });
  const cols = useQuery({ queryKey: ["collections-viewer"], queryFn: () => listCollectionsForViewer() });
  const tog = useMutation({
    mutationFn: (collectionId: string) => toggleSubscription({ data: { collectionId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subs"] }),
  });

  const subIds = new Set((subs.data ?? []).map((s) => s.collectionId));

  return (
    <AppShell>
      <IdleTimeout />
      <h1 className="mb-4 text-xl font-semibold">Subscriptions</h1>
      <p className="mb-6 text-sm text-muted-foreground">Follow collections to get notified when new videos are added.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(cols.data ?? []).map((c) => {
          const on = subIds.has(c.id);
          return (
            <div key={c.id} className="glass flex items-center justify-between rounded-xl p-4">
              <div className="font-medium">{c.name}</div>
              <Button variant={on ? "default" : "outline"} size="sm" onClick={() => tog.mutate(c.id)}>
                {on ? <><BellOff className="mr-1.5 h-4 w-4" /> Unsubscribe</> : <><Bell className="mr-1.5 h-4 w-4" /> Subscribe</>}
              </Button>
            </div>
          );
        })}
        {cols.data?.length === 0 && <div className="col-span-full text-sm text-muted-foreground">No collections yet.</div>}
      </div>
    </AppShell>
  );
}
