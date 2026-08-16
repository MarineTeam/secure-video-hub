import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { getMyList } from "@/lib/browse.functions";
import { toggleWatchLater } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Play, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-list")({
  component: MyListPage,
  head: () => ({
    meta: [
      { title: "My List — Marine Video Portal" },
      { name: "description", content: "Videos you saved to watch later in the Marine Video Portal." },
      { property: "og:title", content: "My List — Marine Video Portal" },
      { property: "og:description", content: "Videos you saved to watch later in the Marine Video Portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function MyListPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["mylist"], queryFn: () => getMyList() });
  const rm = useMutation({
    mutationFn: (videoId: string) => toggleWatchLater({ data: { videoId } }),
    onSuccess: () => {
      toast.success("Removed from My List");
      qc.invalidateQueries({ queryKey: ["mylist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <IdleTimeout />
      <h1 className="mb-6 text-xl font-semibold">My List</h1>
      {list.isLoading && <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>}
      {list.data?.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Nothing saved yet. Tap “My List” on any video to save it here.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(list.data ?? []).map((v) => (
          <div key={v.id} className="group relative">
            <Link to="/watch/$videoId" params={{ videoId: v.id }}>
              <div className="relative aspect-video overflow-hidden rounded-lg glass transition-transform group-hover:scale-[1.02]">
                {v.thumbnail ? (
                  <img src={v.thumbnail} alt={v.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Play className="h-7 w-7" /></div>
                )}
              </div>
              <div className="mt-2 line-clamp-2 text-sm">{v.title}</div>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${v.title} from My List`}
              className="absolute right-1 top-1 bg-background/70"
              onClick={() => rm.mutate(v.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
