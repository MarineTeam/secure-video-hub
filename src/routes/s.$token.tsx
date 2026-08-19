import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validateShareToken, openShare, openPublicShare } from "@/lib/share.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResumablePlayer } from "@/components/resumable-player";
import { Film, Lock } from "lucide-react";

export const Route = createFileRoute("/s/$token")({
  component: SharePage,
  head: () => ({
    meta: [
      { title: "Shared video — Marine Video Portal" },
      { name: "description", content: "Watch a video that was shared with you on the Marine Video Portal." },
      { property: "og:title", content: "Shared video — Marine Video Portal" },
      { property: "og:description", content: "Watch a video that was shared with you on the Marine Video Portal." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SharePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

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

  const publicOpen = useMutation({
    mutationFn: (pw?: string) => openPublicShare({ data: { token, password: pw } }),
  });

  useEffect(() => {
    async function run() {
      if (!info.data?.ok) return;
      if (info.data.accessMode === "public") {
        if (!info.data.needsPassword) publicOpen.mutate(undefined);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) embed.refetch();
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.data]);

  if (info.isLoading) return <div className="p-8 text-center text-sm">Loading…</div>;

  if (!info.data?.ok) {
    const reason = info.data && "reason" in info.data ? info.data.reason : "not_found";
    const msg =
      reason === "expired"
        ? "This share link has expired."
        : reason === "revoked"
          ? "This share link was revoked."
          : reason === "exhausted"
            ? "This share link has reached its view limit."
            : "Share link not found.";
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-lg font-semibold">Link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
        </div>
      </div>
    );
  }

  const playable = publicOpen.data ?? embed.data;
  if (playable) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-md gradient-brand p-1.5"><Film className="h-4 w-4 text-primary-foreground" /></div>
          <div>
            <h1 className="text-lg font-semibold">{playable.title}</h1>
            <p className="text-xs text-muted-foreground">Shared with you</p>
          </div>
        </div>
        <ResumablePlayer src={playable.url} />
      </div>
    );
  }

  if (info.data.accessMode === "public") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass w-full max-w-md rounded-2xl p-8 text-center">
          <div className="mx-auto mb-3 inline-flex rounded-md gradient-brand p-2"><Lock className="h-5 w-5 text-primary-foreground" /></div>
          <h1 className="text-lg font-semibold">{info.data.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {info.data.needsPassword ? "This link is password protected." : "Opening…"}
          </p>
          {info.data.needsPassword && (
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => { e.preventDefault(); publicOpen.mutate(password); }}
            >
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
              <Button type="submit" className="w-full gradient-brand text-primary-foreground" disabled={publicOpen.isPending}>
                Watch
              </Button>
            </form>
          )}
          {publicOpen.error && <p className="mt-3 text-xs text-destructive">{(publicOpen.error as Error).message}</p>}
        </div>
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
