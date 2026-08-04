import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { ResumablePlayer } from "@/components/resumable-player";
import { getSignedEmbed, getMyProgress, saveProgress } from "@/lib/watch.functions";
import { recordView, getRelatedVideos, getViewCounts } from "@/lib/engagement.functions";
import { ChevronLeft, Eye, Monitor, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { VideoActions } from "@/components/video-actions";
import { CommentsSection } from "@/components/comments-section";
import { ShareVideo } from "@/components/share-video";


export const Route = createFileRoute("/_authenticated/watch/$videoId")({
  validateSearch: (search: Record<string, unknown>): { t?: number } => ({ t: Number(search["t"]) || undefined }),
  component: WatchPage,
});

const AUTOPLAY_KEY = "mvp:autoplay-next";
const THEATER_KEY = "mvp:theater";

function WatchPage() {
  const { videoId } = Route.useParams();
  const { t } = Route.useSearch();
  const startAt = t ?? 0;
  const navigate = useNavigate();
  const [autoplay, setAutoplay] = useState(false);
  const [theater, setTheater] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);


  useEffect(() => {
    setAutoplay(localStorage.getItem(AUTOPLAY_KEY) === "1");
    setTheater(localStorage.getItem(THEATER_KEY) === "1");
  }, []);

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

  const nextVideo = (related.data ?? [])[0] ?? null;

  // Reset any pending autoplay countdown when the video changes.
  useEffect(() => {
    setCountdown(null);
  }, [videoId]);

  const onEnded = useCallback(() => {
    if (!autoplay || !nextVideo) return;
    setCountdown(8);
  }, [autoplay, nextVideo]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextVideo) navigate({ to: "/watch/$videoId", params: { videoId: nextVideo.id } });
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, nextVideo, navigate]);

  function toggleTheater() {
    setTheater((v) => {
      localStorage.setItem(THEATER_KEY, v ? "0" : "1");
      return !v;
    });
  }

  // Keyboard shortcut: "t" toggles theater mode (ignored while typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key.toLowerCase() === "t") toggleTheater();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <div className={theater ? "space-y-6" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"}>
          <div className="min-w-0">
            <h1 className="mb-1 text-xl font-semibold">{embed.data.title}</h1>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> {viewCount} view{viewCount === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="autoplay"
                    checked={autoplay}
                    onCheckedChange={(v) => {
                      setAutoplay(v);
                      localStorage.setItem(AUTOPLAY_KEY, v ? "1" : "0");
                      if (!v) setCountdown(null);
                    }}
                  />
                  <Label htmlFor="autoplay" className="text-xs text-muted-foreground">Autoplay next</Label>
                </div>
                <ShareVideo videoId={videoId} currentTime={currentTime} />
                <Button variant="ghost" size="sm" onClick={toggleTheater} title="Theater mode (T)">
                  <Monitor className="mr-1 h-4 w-4" /> {theater ? "Exit theater" : "Theater"}
                </Button>
              </div>
            </div>
            <ResumablePlayer
              src={embed.data.url}
              initialSeconds={startAt > 0 ? startAt : Number(prog.data?.position_seconds ?? 0)}
              onProgress={(position, duration) => {
                setCurrentTime(position);
                saveProgress({ data: { videoId, position, duration } }).catch(() => {});
              }}
              onEnded={onEnded}
            />

            {countdown !== null && nextVideo && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 glass rounded-xl p-3 text-sm">
                <span className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  Up next in {countdown}s — <span className="font-medium">{nextVideo.title}</span>
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCountdown(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => navigate({ to: "/watch/$videoId", params: { videoId: nextVideo.id } })}>
                    Play now
                  </Button>
                </div>
              </div>
            )}
            <VideoActions videoId={videoId} />
            <CommentsSection videoId={videoId} />
          </div>
          <aside className={theater ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "space-y-3"}>
            <h2 className={`text-sm font-medium text-muted-foreground ${theater ? "sm:col-span-2 lg:col-span-4" : ""}`}>Up next</h2>
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
