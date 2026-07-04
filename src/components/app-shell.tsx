import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSessionState } from "@/lib/library.functions";
import { Film, LogOut, Settings, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useQuery({
    queryKey: ["session-state"],
    queryFn: () => getSessionState(),
    staleTime: 30_000,
    retry: false,
  });

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
          <nav className="flex items-center gap-1">
            {session?.isApproved && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/">
                  <Video className="mr-1.5 h-4 w-4" /> Library
                </Link>
              </Button>
            )}
            {session?.isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">
                  <Settings className="mr-1.5 h-4 w-4" /> Admin
                </Link>
              </Button>
            )}
            <div className="mx-2 hidden text-xs text-muted-foreground md:block">{session?.email}</div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Private access. All video playback is signed and time-limited.
      </footer>
    </div>
  );
}
