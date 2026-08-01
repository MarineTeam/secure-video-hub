import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { ResumablePlayer } from "@/components/resumable-player";
import { getSignedEmbed, getMyProgress, saveProgress } from "@/lib/watch.functions";
import { recordView, getRelatedVideos, getViewCounts } from "@/lib/engagement.functions";
import { ChevronLeft, Eye } from "lucide-react";
import { VideoActions } from "@/components/video-actions";
import { CommentsSection } from "@/components/comments-section";

export const Route = createFileRoute("/_authenticated/watch/$videoId")({
  component: WatchPage,
});

function WatchPage() {
  const { videoId } = Route.useParams();
  const embed = useQuery({
    queryKey: ["embed", videoId],
    queryFn: () => getSignedEmbed({ data: { videoId } }),
    retry: false,
  });
  const prog = useQuery({
    queryKey: ["progress", videoId],
    queryFn: () => getMyProgress({ data: { videoId } }),
    retry: false,
  });
  const related = useQuery({
    queryKey: ["related", videoId],
    queryFn: () => getRelatedVideos({ data: { videoId } }),
    retry: false,
  });
  const views = useQuery({
    queryKey: ["views", videoId],
    queryFn: () => getViewCounts({ data: { ids: [videoId] } }),
    retry: false,
  });

  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (!embed.data || logged.current === videoId) return;
    logged.current = videoId;
    recordView({ data: { videoId } }).catch(() => {});
  }, [embed.data, videoId]);

  const viewCount = views.data?.[videoId] ?? 0;

  return (
    <AppShell>
      <IdleTimeout />
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to library
        </Link>
      </div>
      {embed.isLoading && <div className="py-16 text-center text-sm text-muted-foreground">Loading player…</div>}
      {embed.error && <div className="glass rounded-2xl p-6 text-sm text-destructive">{(embed.error as Error).message}</div>}
      {embed.data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <h1 className="mb-1 text-xl font-semibold">{embed.data.title}</h1>
            <div className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> {viewCount} view{viewCount === 1 ? "" : "s"}
            </div>
            <ResumablePlayer
              src={embed.data.url}
              initialSeconds={Number(prog.data?.position_seconds ?? 0)}
              onProgress={(position, duration) => {
                saveProgress({ data: { videoId, position, duration } }).catch(() => {});
              }}
            />
            <VideoActions videoId={videoId} />
            <CommentsSection videoId={videoId} />
          </div>
          <aside className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Up next</h2>
            {(related.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">No other videos yet.</div>
            )}
            {(related.data ?? []).map((v) => (
              <Link key={v.id} to="/watch/$videoId" params={{ videoId: v.id }} className="flex gap-2 group">
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md glass">
                  {v.thumbnail ? <img src={v.thumbnail} alt={v.title} loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="line-clamp-2 text-xs group-hover:text-foreground">{v.title}</div>
              </Link>
            ))}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

