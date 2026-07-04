import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validateShareToken, openShare } from "@/lib/share.functions";
import { Button } from "@/components/ui/button";
import { ResumablePlayer } from "@/components/resumable-player";
import { Film } from "lucide-react";

export const Route = createFileRoute("/s/$token")({
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const info = useQuery({
    queryKey: ["share-info", token],
    queryFn: () => validateShareToken({ data: { token } }),
    retry: false,
  });

  const embed = useQuery({
    queryKey: ["share-embed", token],
    queryFn: () => openShare({ data: { token } }),
    retry: false,
    enabled: false,
  });

  useEffect(() => {
    async function checkAndOpen() {
      if (!info.data?.ok) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        embed.refetch();
      }
    }
    checkAndOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.data]);

  if (info.isLoading) return <div className="p-8 text-center text-sm">Loading…</div>;
  if (!info.data?.ok) {
    const reason = info.data && "reason" in info.data ? info.data.reason : "not_found";
    const msg = reason === "expired" ? "This share link has expired." : reason === "revoked" ? "This share link was revoked." : "Share link not found.";
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-lg font-semibold">Link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
        </div>
      </div>
    );
  }

  if (embed.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-md gradient-brand p-1.5"><Film className="h-4 w-4 text-primary-foreground" /></div>
          <div>
            <h1 className="text-lg font-semibold">{embed.data.title}</h1>
            <p className="text-xs text-muted-foreground">Shared with you</p>
          </div>
        </div>
        <ResumablePlayer src={embed.data.url} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-3 inline-flex rounded-md gradient-brand p-2"><Film className="h-5 w-5 text-primary-foreground" /></div>
        <h1 className="text-lg font-semibold">{info.data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This video was shared with <span className="font-medium">{info.data.recipientEmail}</span>. Sign in with that email to watch.
        </p>
        <Button
          className="mt-5 w-full gradient-brand text-primary-foreground"
          onClick={() => navigate({ to: "/auth", search: { redirect: `/s/${token}` } })}
        >
          Sign in to watch
        </Button>
        {embed.error && <p className="mt-3 text-xs text-destructive">{(embed.error as Error).message}</p>}
      </div>
    </div>
  );
}
