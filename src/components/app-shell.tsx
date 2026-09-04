import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSessionState } from "@/lib/library.functions";
import { Film, LogOut, Menu, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "@/components/notifications-bell";
import { CommandPalette } from "@/components/command-palette";
import { NavIcon } from "@/components/nav-icon";
import { usePlugins } from "@/hooks/use-plugins";
import { PLUGINS, PLUGIN_GROUP_LABELS, type PluginGroup } from "@/lib/plugins/registry";



export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const qc = useQueryClient();
  const { data: session } = useQuery({
    queryKey: ["session-state"],
    queryFn: () => getSessionState(),
    staleTime: 30_000,
    retry: false,
  });

  const { isEnabled, can } = usePlugins();
  const visible = PLUGINS.filter((p) => isEnabled(p.id));
  const navEntries = visible.flatMap((p) =>
    p.nav.filter((e) => !e.admin && can(e.permission)).map((e) => ({ ...e, group: p.group })),
  );
  const navGroups = Array.from(
    navEntries.reduce((m, e) => {
      const list = m.get(e.group) ?? [];
      list.push(e);
      m.set(e.group, list);
      return m;
    }, new Map<PluginGroup, typeof navEntries>()),
  );


  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="rounded-md gradient-brand p-1.5">
              <Film className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="gradient-text tracking-tight">Marine Video Portal</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {session?.isApproved && (
              <>
                <CommandPalette />
                {navEntries.map((e) => (
                  <Button key={e.to} asChild variant="ghost" size="sm">
                    <Link to={e.to as "/"}>
                      <NavIcon name={e.icon} className="mr-1.5 h-4 w-4" /> {e.label}
                    </Link>
                  </Button>
                ))}
                <Button asChild variant="ghost" size="sm" aria-label="Profile settings"><Link to="/profile"><User className="h-4 w-4" /></Link></Button>
                <NotificationsBell />
              </>
            )}

            {session?.isAdmin && (
              <Button asChild variant="ghost" size="sm"><Link to="/admin"><Settings className="mr-1.5 h-4 w-4" /> Admin</Link></Button>
            )}
            <div className="mx-2 hidden text-xs text-muted-foreground md:block">{session?.email}</div>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </nav>

          <div className="flex items-center gap-1 lg:hidden">
            {session?.isApproved && <NotificationsBell />}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="gradient-text text-left">Marine Video Portal</SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-1">
                  {session?.isApproved && (
                    <>
                      {navGroups.map(([group, entries]) => (
                        <div key={group} className="mt-2 first:mt-0">
                          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {PLUGIN_GROUP_LABELS[group]}
                          </div>
                          {entries.map((e) => (
                            <Button key={e.to} asChild variant="ghost" className="w-full justify-start" onClick={() => setMenuOpen(false)}>
                              <Link to={e.to as "/"}>
                                <NavIcon name={e.icon} className="mr-2 h-4 w-4" /> {e.label}
                              </Link>
                            </Button>
                          ))}
                        </div>
                      ))}
                      <Button asChild variant="ghost" className="mt-2 justify-start" onClick={() => setMenuOpen(false)}><Link to="/profile"><User className="mr-2 h-4 w-4" /> Profile</Link></Button>
                    </>
                  )}
                  {session?.isAdmin && (
                    <Button asChild variant="ghost" className="justify-start" onClick={() => setMenuOpen(false)}><Link to="/admin"><Settings className="mr-2 h-4 w-4" /> Admin</Link></Button>
                  )}

                  <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">{session?.email}</div>
                  <Button variant="ghost" className="mt-1 justify-start" onClick={() => { setMenuOpen(false); signOut(); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Private access. All video playback is signed and time-limited.
      </footer>
    </div>
  );
}
