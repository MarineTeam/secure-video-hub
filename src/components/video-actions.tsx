import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, BellRing, Bookmark, BookmarkCheck, Heart, ListPlus, Loader2 } from "lucide-react";
import {
  addToPlaylist,
  createPlaylist,
  getLikeState,
  getVideoContext,
  listPlaylists,
  toggleLike,
  toggleSubscription,
  toggleWatchLater,
} from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function VideoActions({ videoId }: { videoId: string }) {
  const qc = useQueryClient();
  const like = useQuery({ queryKey: ["like", videoId], queryFn: () => getLikeState({ data: { videoId } }) });
  const ctx = useQuery({ queryKey: ["vctx", videoId], queryFn: () => getVideoContext({ data: { videoId } }) });
  const playlists = useQuery({ queryKey: ["playlists"], queryFn: () => listPlaylists() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["like", videoId] });
    qc.invalidateQueries({ queryKey: ["vctx", videoId] });
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };

  const likeMut = useMutation({
    mutationFn: () => toggleLike({ data: { videoId } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const wlMut = useMutation({
    mutationFn: () => toggleWatchLater({ data: { videoId } }),
    onSuccess: (r) => { toast.success(r.saved ? "Saved to Watch Later" : "Removed from Watch Later"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const subMut = useMutation({
    mutationFn: () => toggleSubscription({ data: { collectionId: ctx.data!.collection!.id } }),
    onSuccess: (r) => { toast.success(r.subscribed ? "Subscribed" : "Unsubscribed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMut = useMutation({
    mutationFn: (playlistId: string) => addToPlaylist({ data: { playlistId, videoId } }),
    onSuccess: () => { toast.success("Added to playlist"); qc.invalidateQueries({ queryKey: ["playlists"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newName, setNewName] = useState("");
  const createMut = useMutation({
    mutationFn: async () => {
      const p = await createPlaylist({ data: { name: newName.trim() } });
      await addToPlaylist({ data: { playlistId: p.id, videoId } });
    },
    onSuccess: () => { setNewName(""); toast.success("Playlist created"); qc.invalidateQueries({ queryKey: ["playlists"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button variant={like.data?.liked ? "default" : "outline"} size="sm" onClick={() => likeMut.mutate()}>
        <Heart className={`mr-1.5 h-4 w-4 ${like.data?.liked ? "fill-current" : ""}`} />
        {like.data?.count ?? 0}
      </Button>

      <Button variant="outline" size="sm" onClick={() => wlMut.mutate()}>
        {wlMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> :
          (playlists.data?.some((p) => p.is_watch_later && false) ? <BookmarkCheck className="mr-1.5 h-4 w-4" /> : <Bookmark className="mr-1.5 h-4 w-4" />)}
        Watch Later
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm"><ListPlus className="mr-1.5 h-4 w-4" /> Save</Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Save to playlist</div>
          <div className="max-h-48 space-y-1 overflow-auto">
            {(playlists.data ?? []).map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => addMut.mutate(p.id)}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.itemCount}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-1">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist…" className="h-8 text-sm" />
            <Button size="sm" disabled={!newName.trim() || createMut.isPending} onClick={() => createMut.mutate()}>Add</Button>
          </div>
        </PopoverContent>
      </Popover>

      {ctx.data?.collection && (
        <Button variant={ctx.data.subscribed ? "default" : "outline"} size="sm" onClick={() => subMut.mutate()}>
          {ctx.data.subscribed ? <BellRing className="mr-1.5 h-4 w-4" /> : <Bell className="mr-1.5 h-4 w-4" />}
          {ctx.data.subscribed ? "Subscribed" : "Subscribe"} · {ctx.data.collection.name}
        </Button>
      )}
    </div>
  );
}
