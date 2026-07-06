import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { createPlaylist, deletePlaylist, listPlaylists } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListMusic, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/playlists")({ component: PlaylistsPage });

function PlaylistsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["playlists"], queryFn: () => listPlaylists() });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createPlaylist({ data: { name: name.trim() } }),
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["playlists"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deletePlaylist({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <IdleTimeout />
      <div className="mb-6 flex items-end gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Playlists</h1>
          <p className="text-sm text-muted-foreground">Organize videos into your own lists.</p>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" className="max-w-xs" />
        <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}><Plus className="mr-1.5 h-4 w-4" /> Create</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(list.data ?? []).map((p) => (
          <div key={p.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between">
              <Link to="/playlists/$id" params={{ id: p.id }} className="flex items-center gap-2 font-medium hover:underline">
                <ListMusic className="h-4 w-4" /> {p.name}
              </Link>
              {!p.is_watch_later && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del.mutate(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{p.itemCount} video{p.itemCount === 1 ? "" : "s"}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
