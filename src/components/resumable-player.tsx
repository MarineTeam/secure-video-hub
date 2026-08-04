import { useEffect, useRef } from "react";
// player.js has no types but is bundled
// @ts-expect-error - player.js has no types
import Player from "player.js";

export function ResumablePlayer({
  src,
  initialSeconds,
  onProgress,
  onEnded,
}: {
  src: string;
  initialSeconds?: number;
  onProgress?: (position: number, duration: number) => void;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let cancelled = false;
    let lastSent = 0;
    const t = setTimeout(() => {
      try {
        const player = new Player(iframe);
        player.on("ready", () => {
          if (cancelled) return;
          if (initialSeconds && initialSeconds > 3) {
            player.setCurrentTime(initialSeconds);
          }
        });
        player.on("timeupdate", (e: { seconds: number; duration: number }) => {
          if (!onProgress) return;
          if (!e || !e.duration) return;
          const now = Date.now();
          if (now - lastSent < 5000) return;
          lastSent = now;
          onProgress(e.seconds, e.duration);
        });
        player.on("ended", () => {
          if (cancelled) return;
          endedRef.current?.();
        });
      } catch (err) {
        console.warn("player init failed", err);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl glass">
      <iframe
        ref={ref}
        src={src}
        title="Video player"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
