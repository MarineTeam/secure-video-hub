import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationsRead, unreadNotificationCount } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationsBell() {
  const qc = useQueryClient();
  const unread = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => unreadNotificationCount(),
    refetchInterval: 60_000,
    retry: false,
  });
  const list = useQuery({ queryKey: ["notif-list"], queryFn: () => listNotifications(), retry: false });
  const markAll = useMutation({
    mutationFn: () => markNotificationsRead({ data: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  const count = unread.data?.count ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">Notifications</div>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAll.mutate()}>Mark all read</Button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {(list.data ?? []).length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">All caught up.</div>}
          {(list.data ?? []).map((n) => (
            <Link
              key={n.id}
              to={n.bunny_video_id ? "/watch/$videoId" : "/"}
              params={n.bunny_video_id ? { videoId: n.bunny_video_id } : undefined}
              className={`block border-b px-3 py-2 text-sm hover:bg-muted ${n.read_at ? "opacity-60" : ""}`}
            >
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
              <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
