import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createMyShare, getMySharePrivileges } from "@/lib/share.functions";

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export function ShareVideo({ videoId, currentTime }: { videoId: string; currentTime: number }) {
  const [withTime, setWithTime] = useState(false);
  const [copied, setCopied] = useState(false);

  // Managed share-link state
  const [mode, setMode] = useState<"email" | "public">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ttl, setTtl] = useState("72");
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const privileges = useQuery({
    queryKey: ["my-share-privileges"],
    queryFn: () => getMySharePrivileges(),
    staleTime: 300_000,
    retry: false,
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const memberLink = useMemo(
    () => `${origin}/watch/${videoId}${withTime ? `?t=${Math.floor(currentTime)}` : ""}`,
    [origin, videoId, withTime, currentTime],
  );

  const create = useMutation({
    mutationFn: () =>
      createMyShare({
        data: {
          videoId,
          accessMode: mode,
          recipientEmail: mode === "email" ? email.trim() : null,
          password: mode === "public" && password.trim() ? password.trim() : null,
          label: label.trim() || null,
          ttlHours: Number(ttl),
        },
      }),
    onSuccess: (r) => {
      const url = `${origin}/s/${r.token}`;
      setCreated(url);
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success(mode === "email" ? "Invite link created and emailed." : "Public link created and copied.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyMemberLink() {
    navigator.clipboard.writeText(memberLink);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  const canShare = privileges.data?.canShare;
  const canPublic = privileges.data?.canSharePublic;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm"><Share2 className="mr-1.5 h-4 w-4" /> Share</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Members link</div>
          <div className="flex items-center gap-2">
            <Input readOnly value={memberLink} className="text-xs" />
            <Button size="sm" variant="secondary" onClick={copyMemberLink} aria-label="Copy link">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="with-time" checked={withTime} onCheckedChange={(v) => setWithTime(!!v)} />
            <Label htmlFor="with-time" className="text-xs text-muted-foreground">Start at {fmt(currentTime)}</Label>
          </div>
          <p className="text-[11px] text-muted-foreground">Only approved members can open this.</p>
        </div>

        {canShare && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-sm font-medium">Guest share link</div>
            <Select value={mode} onValueChange={(v) => setMode(v as "email" | "public")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Private — one email address</SelectItem>
                {canPublic && <SelectItem value="public">Public — anyone with the link</SelectItem>}
              </SelectContent>
            </Select>
            {mode === "email" ? (
              <Input placeholder="guest@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs" />
            ) : (
              <Input
                type="password"
                placeholder="Optional password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs"
              />
            )}
            <div className="flex gap-2">
              <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="text-xs" />
              <Select value={ttl} onValueChange={setTtl}>
                <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
              Create link
            </Button>
            {created && (
              <div className="flex items-center gap-2">
                <Input readOnly value={created} className="text-xs" />
                <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(created); toast.success("Copied"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Manage or revoke these under Profile → Shared links.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
