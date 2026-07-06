import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { getPlaylist, removeFromPlaylist } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/playlists/$id")({ component: PlaylistDetail });

function PlaylistDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["playlist", id], queryFn: () => getPlaylist({ data: { id } }) });
  const del = useMutation({
    mutationFn: (videoId: string) => removeFromPlaylist({ data: { playlistId: id, videoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist", id] }),
  });

  return (
    <AppShell>
      <IdleTimeout />
      <div className="mb-4">
        <Link to="/playlists" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All playlists
        </Link>
      </div>
      {q.data && (
        <>
          <h1 className="text-xl font-semibold">{q.data.playlist.name}</h1>
          {q.data.playlist.description && <p className="mt-1 text-sm text-muted-foreground">{q.data.playlist.description}</p>}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {q.data.items.map((v) => (
              <div key={v.id} className="group relative">
                <Link to="/watch/$videoId" params={{ videoId: v.id }}>
                  <div className="aspect-video overflow-hidden rounded-lg glass">
                    {v.thumbnail && <img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm">{v.title}</div>
                </Link>
                <Button
                  variant="ghost" size="sm"
                  className="absolute right-1 top-1 opacity-0 group-hover:opacity-100"
                  onClick={() => del.mutate(v.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {q.data.items.length === 0 && <div className="col-span-full py-12 text-center text-sm text-muted-foreground">Empty playlist.</div>}
          </div>
        </>
      )}
    </AppShell>
  );
}
