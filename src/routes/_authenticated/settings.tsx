import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { IdleTimeout } from "@/components/theme-provider";
import { getMyProfile, upsertMyProfile } from "@/lib/profile.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Profile settings — Marine Video Portal" },
      { name: "description", content: "Update your display name, avatar and bio for the Marine Video Portal." },
      { property: "og:title", content: "Profile settings — Marine Video Portal" },
      { property: "og:description", content: "Update your display name, avatar and bio for the Marine Video Portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => getMyProfile(), retry: false });
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name ?? "");
    setAvatarUrl(profile.data.avatar_url ?? "");
    setBio(profile.data.bio ?? "");
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => upsertMyProfile({ data: { display_name: displayName, avatar_url: avatarUrl, bio } }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["comments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (displayName || profile.data?.email || "?").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <IdleTimeout />
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 text-2xl font-bold gradient-text">Profile</h1>
        <div className="glass space-y-4 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your avatar" /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">{profile.data?.email}</div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} placeholder="How others see you on comments" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avatar-url">Avatar image URL</Label>
            <Input id="avatar-url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} maxLength={500} rows={3} onChange={(e) => setBio(e.target.value)} placeholder="A short line about you" />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save profile</Button>
        </div>
      </div>
    </AppShell>
  );
}
