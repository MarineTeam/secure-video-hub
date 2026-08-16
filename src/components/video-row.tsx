import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RowItem = {
  id: string;
  title: string;
  thumbnail: string | null;
  progress?: number | null;
};

export function VideoRow({ title, items, icon }: { title: string; items: RowItem[]; icon?: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  if (!items.length) return null;

  const scroll = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className="group/row">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">{icon} {title}</h2>
        <div className="hidden gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 sm:flex">
          <Button variant="ghost" size="sm" aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Scroll ${title} right`} onClick={() => scroll(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={scroller} className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((v) => (
          <Link
            key={v.id}
            to="/watch/$videoId"
            params={{ videoId: v.id }}
            className="group w-40 shrink-0 sm:w-52"
          >
            <div className="relative aspect-video overflow-hidden rounded-lg glass transition-transform group-hover:scale-[1.04]">
              {v.thumbnail ? (
                <img src={v.thumbnail} alt={v.title} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Play className="h-6 w-6" /></div>
              )}
              {typeof v.progress === "number" && v.progress > 0 && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                  <div className="h-full gradient-brand" style={{ width: `${Math.min(100, v.progress)}%` }} />
                </div>
              )}
            </div>
            <div className="mt-1.5 line-clamp-2 text-xs">{v.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
