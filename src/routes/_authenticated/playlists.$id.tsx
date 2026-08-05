import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { getPlaylist, removeFromPlaylist, reorderPlaylist, setPlaylistSharing } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/playlists/$id")({
  head: () => ({
    meta: [
      { title: "Playlist — Marine Video Portal" },
      { name: "description", content: "View, reorder and share the videos saved in your playlist." },
      { property: "og:title", content: "Playlist — Marine Video Portal" },
      { property: "og:description", content: "View, reorder and share the videos saved in your playlist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlaylistDetail,
});

function PlaylistDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["playlist", id], queryFn: () => getPlaylist({ data: { id } }) });

  const del = useMutation({
    mutationFn: (videoId: string) => removeFromPlaylist({ data: { playlistId: id, videoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist", id] }),
  });
  const reorder = useMutation({
    mutationFn: (order: string[]) => reorderPlaylist({ data: { playlistId: id, order } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist", id] }),
  });
  const share = useMutation({
    mutationFn: (isPublic: boolean) => setPlaylistSharing({ data: { playlistId: id, isPublic } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist", id] }),
  });

  const items = q.data?.items ?? [];
  const playlist = q.data?.playlist;

  function move(index: number, dir: -1 | 1) {
    const next = [...items.map((i) => i.id)];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    reorder.mutate(next);
  }

  const shareUrl =
    playlist?.is_public && playlist.share_token
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${playlist.share_token}`
      : null;

  return (
    <AppShell>
      <IdleTimeout />
      <div className="mb-4">
        <Link to="/playlists" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All playlists
        </Link>
      </div>
      {q.data && playlist && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{playlist.name}</h1>
              {playlist.description && <p className="mt-1 text-sm text-muted-foreground">{playlist.description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                disabled={!items.length}
                onClick={() => items[0] && navigate({ to: "/watch/$videoId", params: { videoId: items[0].id } })}
              >
                <Play className="mr-1 h-4 w-4" /> Play all
              </Button>
              <div className="flex items-center gap-2">
                <Switch
                  id="public"
                  checked={!!playlist.is_public}
                  onCheckedChange={(v) => share.mutate(v)}
                />
                <Label htmlFor="public" className="text-xs text-muted-foreground">Public link</Label>
              </div>
              {shareUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Share link copied");
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copy link
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((v, i) => (
              <div key={v.id} className="group relative">
                <Link to="/watch/$videoId" params={{ videoId: v.id }}>
                  <div className="aspect-video overflow-hidden rounded-lg glass">
                    {v.thumbnail && <img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm">{v.title}</div>
                </Link>
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button variant="ghost" size="sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => del.mutate(v.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="col-span-full py-12 text-center text-sm text-muted-foreground">Empty playlist.</div>}
          </div>
        </>
      )}
    </AppShell>
  );
}
