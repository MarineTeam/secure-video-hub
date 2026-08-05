import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicPlaylist } from "@/lib/social.functions";
import { ListMusic } from "lucide-react";

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shared playlist — Marine Video Portal" },
      { name: "description", content: "A playlist of marine training videos shared with you." },
      { property: "og:title", content: "Shared playlist — Marine Video Portal" },
      { property: "og:description", content: "A playlist of marine training videos shared with you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPlaylist,
});

function PublicPlaylist() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-playlist", token],
    queryFn: () => getPublicPlaylist({ data: { token } }),
    retry: false,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-center gap-2 text-muted-foreground">
        <ListMusic className="h-5 w-5" />
        <span className="text-sm">Shared playlist</span>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && !q.data.name && (
        <p className="text-sm text-muted-foreground">This playlist is not available.</p>
      )}
      {q.data?.name && (
        <>
          <h1 className="text-2xl font-semibold">{q.data.name}</h1>
          {q.data.description && <p className="mt-1 text-sm text-muted-foreground">{q.data.description}</p>}
          <ul className="mt-6 space-y-2">
            {q.data.items.map((v, i) => (
              <li key={v.id} className="glass flex items-center gap-3 rounded-xl p-3 text-sm">
                <span className="w-6 text-right font-mono text-muted-foreground">{i + 1}</span>
                <span className="flex-1">{v.title}</span>
                <Link to="/watch/$videoId" params={{ videoId: v.id }} className="text-xs text-primary hover:underline">
                  Watch
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">
            Sign in to watch these videos — access is limited to approved viewers.
          </p>
        </>
      )}
    </div>
  );
}
