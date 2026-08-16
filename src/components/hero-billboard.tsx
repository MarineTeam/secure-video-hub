import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isInMyList } from "@/lib/browse.functions";
import { toggleWatchLater } from "@/lib/social.functions";
import { toast } from "sonner";

export function HeroBillboard({
  video,
  resumeAt,
}: {
  video: { id: string; title: string; thumbnail: string | null };
  resumeAt?: number;
}) {
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["mylist-state", video.id], queryFn: () => isInMyList({ data: { videoId: video.id } }) });
  const mut = useMutation({
    mutationFn: () => toggleWatchLater({ data: { videoId: video.id } }),
    onSuccess: (r) => {
      toast.success(r.saved ? "Added to My List" : "Removed from My List");
      qc.invalidateQueries({ queryKey: ["mylist-state", video.id] });
      qc.invalidateQueries({ queryKey: ["mylist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="relative overflow-hidden rounded-2xl glass">
      <div className="absolute inset-0">
        {video.thumbnail && <img src={video.thumbnail} alt="" className="h-full w-full object-cover opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      </div>
      <div className="relative flex min-h-[220px] flex-col justify-end gap-3 p-5 sm:min-h-[320px] sm:p-8">
        <span className="text-xs uppercase tracking-widest text-primary">Featured</span>
        <h1 className="max-w-xl text-2xl font-semibold sm:text-4xl">{video.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/watch/$videoId" params={{ videoId: video.id }} search={resumeAt ? { t: resumeAt } : {}}>
              <Play className="mr-1.5 h-4 w-4 fill-current" /> {resumeAt ? "Resume" : "Play"}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {saved.data?.saved ? <Check className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
            My List
          </Button>
        </div>
      </div>
    </section>
  );
}
