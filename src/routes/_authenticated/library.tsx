import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { getLibraryPage, listCollectionsForViewer, getContinueWatching, getSessionState } from "@/lib/library.functions";
import { getTrending, getViewCounts } from "@/lib/engagement.functions";
import { getBrowseRows, getMyList } from "@/lib/browse.functions";
import { HeroBillboard } from "@/components/hero-billboard";
import { VideoRow } from "@/components/video-row";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Play, Flame, Eye, Bookmark, Clapperboard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SortKey = "recent" | "views" | "title" | "longest";

function formatViews(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K views`;
  return `${n} view${n === 1 ? "" : "s"}`;
}

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

function formatDuration(s: number) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function LibraryPage() {
  const { data: session } = useQuery({ queryKey: ["session-state"], queryFn: () => getSessionState() });

  const [q, setQ] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("recent");

  const cols = useQuery({
    queryKey: ["collections-viewer"],
    queryFn: () => listCollectionsForViewer(),
    enabled: session?.isApproved === true,
  });
  const continueWatching = useQuery({
    queryKey: ["continue"],
    queryFn: () => getContinueWatching(),
    enabled: session?.isApproved === true,
  });
  const lib = useQuery({
    queryKey: ["library", q, collectionId, page],
    queryFn: () => getLibraryPage({ data: { q: q || undefined, collectionId, page } }),
    enabled: session?.isApproved === true,
  });
  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: () => getTrending({ data: { days: 30, limit: 8 } }),
    enabled: session?.isApproved === true,
    retry: false,
  });
  const browse = useQuery({
    queryKey: ["browse-rows"],
    queryFn: () => getBrowseRows(),
    enabled: session?.isApproved === true,
    retry: false,
  });
  const myList = useQuery({
    queryKey: ["mylist"],
    queryFn: () => getMyList(),
    enabled: session?.isApproved === true,
    retry: false,
  });
  const libIds = (lib.data?.items ?? []).map((v) => v.id);
  const counts = useQuery({
    queryKey: ["view-counts", libIds],
    queryFn: () => getViewCounts({ data: { ids: libIds } }),
    enabled: libIds.length > 0,
    retry: false,
  });

  if (!session) {
    return <AppShell><div className="p-8 text-center text-sm text-muted-foreground">Loading…</div></AppShell>;
  }

  if (!session.isApproved) {
    return (
      <AppShell>
        <IdleTimeout />
        <div className="mx-auto mt-20 max-w-lg glass rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold">Not approved yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You're signed in as <span className="font-medium">{session.email}</span>, but your address hasn't been added to the approved viewers list.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Please contact an admin.</p>
        </div>
      </AppShell>
    );
  }

  const sortedItems = [...(lib.data?.items ?? [])].sort((a, b) => {
    if (sort === "views") return (counts.data?.[b.id] ?? 0) - (counts.data?.[a.id] ?? 0);
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "longest") return (b.length ?? 0) - (a.length ?? 0);
    return 0;
  });

  const totalPages = lib.data ? Math.max(1, Math.ceil(lib.data.total / lib.data.perPage)) : 1;

  return (
    <AppShell>
      <IdleTimeout />
      <div className="space-y-8">
        {browse.data?.hero && (
          <HeroBillboard
            video={browse.data.hero}
            {...(() => {
              const r = (continueWatching.data ?? []).find((c) => c.id === browse.data!.hero!.id);
              return r && r.position > 5 ? { resumeAt: Math.floor(r.position) } : {};
            })()}
          />
        )}

        {continueWatching.data && continueWatching.data.length > 0 && (
          <VideoRow
            title="Continue watching"
            items={continueWatching.data.map((v) => ({
              id: v.id,
              title: v.title,
              thumbnail: v.thumbnail,
              progress: (v.position / Math.max(1, v.duration)) * 100,
            }))}
          />
        )}

        {myList.data && myList.data.length > 0 && (
          <VideoRow
            title="My List"
            icon={<Bookmark className="h-4 w-4 text-primary" />}
            items={myList.data.map((v) => ({ id: v.id, title: v.title, thumbnail: v.thumbnail }))}
          />
        )}

        {trending.data && trending.data.length > 0 && (
          <VideoRow
            title="Trending this month"
            icon={<Flame className="h-4 w-4 text-primary" />}
            items={trending.data.map((v) => ({ id: v.id, title: v.title, thumbnail: v.thumbnail }))}
          />
        )}

        {(browse.data?.rows ?? []).map((row) => (
          <VideoRow key={row.id} title={row.name} icon={<Clapperboard className="h-4 w-4 text-primary" />} items={row.items} />
        ))}




        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search videos…" className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button variant={collectionId === null ? "default" : "outline"} size="sm" onClick={() => { setCollectionId(null); setPage(1); }}>All</Button>
              {(cols.data ?? []).map((c) => (
                <Button key={c.id} variant={collectionId === c.id ? "default" : "outline"} size="sm" onClick={() => { setCollectionId(c.id); setPage(1); }}>{c.name}</Button>
              ))}
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[160px]" aria-label="Sort videos">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="views">Most viewed</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
                <SelectItem value="longest">Longest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {lib.isLoading && <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>}
          {lib.data && lib.data.items.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">No videos found.</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedItems.map((v) => (
              <Link key={v.id} to="/watch/$videoId" params={{ videoId: v.id }} className="group">
                <div className="relative aspect-video overflow-hidden rounded-lg glass transition-transform group-hover:scale-[1.02]">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt={v.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Play className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-end justify-between p-2">
                    {v.length > 0 && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{formatDuration(v.length)}</span>}
                    {v.status !== 4 && <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">Processing</span>}
                  </div>
                </div>
                <div className="mt-2 line-clamp-2 text-sm">{v.title}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Eye className="h-3 w-3" /> {formatViews(counts.data?.[v.id] ?? 0)}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
