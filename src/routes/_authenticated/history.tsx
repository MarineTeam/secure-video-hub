import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { clearWatchHistory, getWatchHistory, removeHistoryItem } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

function HistoryPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["history"], queryFn: () => getWatchHistory() });
  const clr = useMutation({ mutationFn: () => clearWatchHistory(), onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }) });
  const rm = useMutation({
    mutationFn: (videoId: string) => removeHistoryItem({ data: { videoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  return (
    <AppShell>
      <IdleTimeout />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Watch history</h1>
        <Button variant="outline" size="sm" onClick={() => clr.mutate()} disabled={!q.data?.length}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Clear all
        </Button>
      </div>
      <div className="space-y-2">
        {(q.data ?? []).map((v) => (
          <div key={v.id} className="glass flex items-center gap-3 rounded-lg p-2">
            <Link to="/watch/$videoId" params={{ videoId: v.id }} className="flex flex-1 items-center gap-3">
              <div className="relative aspect-video w-32 overflow-hidden rounded">
                {v.thumbnail && <img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                  <div className="h-full gradient-brand" style={{ width: `${Math.min(100, (v.position / Math.max(1, v.duration)) * 100)}%` }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="line-clamp-2 text-sm font-medium">{v.title}</div>
                <div className="text-xs text-muted-foreground">Last watched {new Date(v.updatedAt).toLocaleString()}</div>
              </div>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => rm.mutate(v.id)}><X className="h-4 w-4" /></Button>
          </div>
        ))}
        {q.data?.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">Nothing here yet.</div>}
      </div>
    </AppShell>
  );
}
