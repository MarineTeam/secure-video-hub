import {
  Bell,
  BookOpenText,
  Bookmark,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  History,
  Languages,
  ListMusic,
  Megaphone,
  MonitorPlay,
  Rss,
  Users,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Bell,
  BookOpenText,
  Bookmark,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  History,
  Languages,
  ListMusic,
  Megaphone,
  MonitorPlay,
  Rss,
  Users,
  UsersRound,
  Video,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Video;
  return <Icon className={className} />;
}
