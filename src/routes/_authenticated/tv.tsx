import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PluginGate } from "@/components/plugin-gate";
import { listAnnouncements } from "@/lib/announcements.functions";
import { listEvents } from "@/lib/events.functions";
import { useLang, pick } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/tv")({
  head: () => ({
    meta: [
      { title: "Lobby display — Marine Video Portal" },
      { name: "description", content: "Full-screen rotating announcements and upcoming events for lobby screens." },
      { property: "og:title", content: "Lobby display — Marine Video Portal" },
      { property: "og:description", content: "Full-screen rotating announcements and upcoming events for lobby screens." },
    ],
  }),
  component: () => (
    <PluginGate plugin="tv">
      <TvPage />
    </PluginGate>
  ),
});

function TvPage() {
  const lang = useLang();
  const [i, setI] = useState(0);
  const slides = useQuery({
    queryKey: ["tv-announcements"],
    queryFn: () => listAnnouncements({ data: { tvOnly: true } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const events = useQuery({ queryKey: ["events"], queryFn: () => listEvents(), retry: false });

  const items = slides.data ?? [];
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 12_000);
    return () => clearInterval(t);
  }, [items.length]);

  const current = items[i % Math.max(items.length, 1)];
  const upcoming = (events.data ?? []).filter((e) => new Date(e.starts_at).getTime() > Date.now()).slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col bg-background p-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {slides.isLoading && <p className="text-2xl text-muted-foreground">Loading…</p>}
        {!slides.isLoading && !current && (
          <p className="text-3xl text-muted-foreground">Welcome — no announcements right now.</p>
        )}
        {current && (
          <>
            {current.image_url && (
              <img src={current.image_url} alt="" className="mb-8 max-h-[45vh] rounded-2xl object-contain" />
            )}
            <h1 className="max-w-5xl text-6xl font-bold leading-tight gradient-text">{current.title}</h1>
            <p className="mt-6 max-w-4xl whitespace-pre-wrap text-3xl text-muted-foreground">
              {pick(lang, current.body, current.body_es)}
            </p>
          </>
        )}
      </div>
      {upcoming.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="mb-3 text-lg uppercase tracking-widest text-muted-foreground">Coming up</h2>
          <ul className="grid gap-2 text-2xl md:grid-cols-2">
            {upcoming.map((e) => (
              <li key={e.id} className="flex justify-between gap-4">
                <span className="truncate">{e.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex justify-center gap-2">
        {items.map((s, idx) => (
          <span
            key={s.id}
            className={`h-2 w-2 rounded-full ${idx === i % items.length ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}
