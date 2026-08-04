import { useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export function ShareVideo({ videoId, currentTime }: { videoId: string; currentTime: number }) {
  const [withTime, setWithTime] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/watch/${videoId}${withTime ? `?t=${Math.floor(currentTime)}` : ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the link and copy manually.");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Share2 className="mr-1.5 h-4 w-4" /> Share</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" /> Share this video
        </div>
        <Input readOnly value={url} className="h-8 text-xs" onFocus={(e) => e.currentTarget.select()} />
        <div className="mt-2 flex items-center gap-2">
          <Checkbox id="share-time" checked={withTime} onCheckedChange={(v) => setWithTime(v === true)} />
          <Label htmlFor="share-time" className="text-xs text-muted-foreground">
            Start at {fmt(currentTime)}
          </Label>
        </div>
        <Button size="sm" className="mt-3 w-full" onClick={copy}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Only approved viewers can open this link. Use Admin → Shares to send a link to someone outside the portal.
        </p>
      </PopoverContent>
    </Popover>
  );
}
