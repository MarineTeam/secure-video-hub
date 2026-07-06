import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { ResumablePlayer } from "@/components/resumable-player";
import { getSignedEmbed, getMyProgress, saveProgress } from "@/lib/watch.functions";
import { ChevronLeft } from "lucide-react";
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
        <>
          <h1 className="mb-3 text-xl font-semibold">{embed.data.title}</h1>
          <ResumablePlayer
            src={embed.data.url}
            initialSeconds={Number(prog.data?.position_seconds ?? 0)}
            onProgress={(position, duration) => {
              saveProgress({ data: { videoId, position, duration } }).catch(() => {});
            }}
          />
          <VideoActions videoId={videoId} />
          <CommentsSection videoId={videoId} />
        </>
      )}
    </AppShell>
  );
}
