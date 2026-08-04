import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, ListMusic, Rss, Search, Settings, Video } from "lucide-react";
import { searchVideos } from "@/lib/library.functions";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";

const PAGES = [
  { to: "/", label: "Library", icon: Video },
  { to: "/playlists", label: "Playlists", icon: ListMusic },
  { to: "/subscriptions", label: "Subscriptions", icon: Rss },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Profile settings", icon: Settings },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useQuery({
    queryKey: ["cmd-search", q],
    queryFn: () => searchVideos({ data: { q } }),
    enabled: open && q.trim().length > 1,
    retry: false,
  });

  function go(to: string, params?: { videoId: string }) {
    setOpen(false);
    setQ("");
    if (params) navigate({ to: "/watch/$videoId", params });
    else navigate({ to: to as "/" });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden items-center gap-2 text-muted-foreground md:inline-flex"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
        <span className="text-xs">Search</span>
        <kbd className="rounded border px-1 text-[10px]">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search videos or jump to a page…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>{results.isFetching ? "Searching…" : "No results."}</CommandEmpty>
          {(results.data ?? []).length > 0 && (
            <CommandGroup heading="Videos">
              {(results.data ?? []).map((v) => (
                <CommandItem key={v.id} value={`video-${v.id}-${v.title}`} onSelect={() => go("", { videoId: v.id })}>
                  <Video className="mr-2 h-4 w-4" />
                  <span className="truncate">{v.title}</span>
                  {v.collection && <span className="ml-auto text-xs text-muted-foreground">{v.collection}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Go to">
            {PAGES.map((p) => (
              <CommandItem key={p.to} value={p.label} onSelect={() => go(p.to)}>
                <p.icon className="mr-2 h-4 w-4" /> {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
