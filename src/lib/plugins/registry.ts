// Central plugin registry. Client-safe: contains no server logic.
// Enable/disable state lives in the `plugin_states` table; defaults live here.

export type PluginGroup = "core" | "worship" | "church" | "communication" | "display" | "localization";

export type NavEntry = {
  label: string;
  to: string;
  icon: string; // lucide icon name
  permission?: string;
  admin?: boolean;
};

export type PluginDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  group: PluginGroup;
  /** Core plugins cannot be disabled. */
  core?: boolean;
  defaultEnabled: boolean;
  permissions: string[];
  nav: NavEntry[];
  /** Route path prefixes that require this plugin to be enabled. */
  routes: string[];
  tables: string[];
};

export const PLUGIN_GROUP_LABELS: Record<PluginGroup, string> = {
  core: "Core",
  worship: "Worship",
  church: "Church",
  communication: "Communication",
  display: "Display",
  localization: "Localization",
};

export const PLUGINS: PluginDef[] = [
  {
    id: "media",
    name: "Media library",
    description: "Videos, collections, series, files, playback and search.",
    icon: "Video",
    group: "core",
    core: true,
    defaultEnabled: true,
    permissions: ["media.read", "media.manage"],
    nav: [
      { label: "Library", to: "/", icon: "Video" },
      { label: "My List", to: "/my-list", icon: "Bookmark" },
      { label: "Playlists", to: "/playlists", icon: "ListMusic" },
      { label: "Subscriptions", to: "/subscriptions", icon: "Rss" },
      { label: "History", to: "/history", icon: "History" },
    ],
    routes: ["/", "/my-list", "/playlists", "/subscriptions", "/history", "/watch"],
    tables: ["video_metadata", "collections", "series", "media_files"],
  },
  {
    id: "hymnal",
    name: "Hymnal",
    description: "Hymn book with lyrics, numbers, authors and searchable scan text.",
    icon: "BookOpenText",
    group: "worship",
    defaultEnabled: true,
    permissions: ["hymnal.read", "hymnal.manage"],
    nav: [{ label: "Hymnal", to: "/hymnal", icon: "BookOpenText" }],
    routes: ["/hymnal"],
    tables: ["hymns"],
  },
  {
    id: "services",
    name: "Service planning",
    description: "Plan services with a drag-and-drop running order.",
    icon: "CalendarClock",
    group: "worship",
    defaultEnabled: true,
    permissions: ["services.read", "services.manage"],
    nav: [{ label: "Services", to: "/services", icon: "CalendarClock" }],
    routes: ["/services"],
    tables: ["services", "service_items"],
  },
  {
    id: "rotas",
    name: "Rotas",
    description: "Volunteer scheduling with roles, availability and confirmations.",
    icon: "Users",
    group: "worship",
    defaultEnabled: true,
    permissions: ["rotas.read", "rotas.manage"],
    nav: [{ label: "Rotas", to: "/rotas", icon: "Users" }],
    routes: ["/rotas"],
    tables: ["rota_roles", "rota_assignments"],
  },
  {
    id: "events",
    name: "Events",
    description: "Events with registration, capacity and attendance.",
    icon: "CalendarDays",
    group: "church",
    defaultEnabled: true,
    permissions: ["events.read", "events.manage"],
    nav: [{ label: "Events", to: "/events", icon: "CalendarDays" }],
    routes: ["/events"],
    tables: ["events", "event_registrations"],
  },
  {
    id: "forms",
    name: "Forms",
    description: "Reusable form builder with submissions and CSV export.",
    icon: "ClipboardList",
    group: "church",
    defaultEnabled: true,
    permissions: ["forms.read", "forms.manage"],
    nav: [{ label: "Forms", to: "/forms", icon: "ClipboardList" }],
    routes: ["/forms"],
    tables: ["forms", "form_submissions"],
  },
  {
    id: "prayer",
    name: "Prayer wall",
    description: "Moderated prayer requests, public or private, with answered state.",
    icon: "HeartHandshake",
    group: "church",
    defaultEnabled: true,
    permissions: ["prayer.read", "prayer.manage"],
    nav: [{ label: "Prayer", to: "/prayer", icon: "HeartHandshake" }],
    routes: ["/prayer"],
    tables: ["prayer_requests"],
  },
  {
    id: "groups",
    name: "Small groups",
    description: "Group directory with leaders, meeting times and capacity.",
    icon: "UsersRound",
    group: "church",
    defaultEnabled: true,
    permissions: ["groups.read", "groups.manage"],
    nav: [{ label: "Groups", to: "/groups", icon: "UsersRound" }],
    routes: ["/groups"],
    tables: ["small_groups"],
  },
  {
    id: "announcements",
    name: "Announcements",
    description: "Pinned, prioritised announcements with audience and expiry.",
    icon: "Megaphone",
    group: "church",
    defaultEnabled: true,
    permissions: ["announcements.read", "announcements.manage"],
    nav: [{ label: "Announcements", to: "/announcements", icon: "Megaphone" }],
    routes: ["/announcements"],
    tables: ["announcements"],
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "In-app notifications plus optional email, SMS and web push.",
    icon: "Bell",
    group: "communication",
    defaultEnabled: true,
    permissions: ["notifications.manage"],
    nav: [],
    routes: [],
    tables: ["notifications"],
  },
  {
    id: "tv",
    name: "TV display",
    description: "Chrome-free full-screen display for lobby and service screens.",
    icon: "MonitorPlay",
    group: "display",
    defaultEnabled: true,
    permissions: ["tv.read"],
    nav: [{ label: "TV", to: "/tv", icon: "MonitorPlay" }],
    routes: ["/tv"],
    tables: [],
  },
  {
    id: "spanish",
    name: "Spanish",
    description: "Spanish interface language option for members.",
    icon: "Languages",
    group: "localization",
    defaultEnabled: false,
    permissions: [],
    nav: [],
    routes: [],
    tables: [],
  },
];

export const PLUGIN_IDS = PLUGINS.map((p) => p.id);

export function getPlugin(id: string): PluginDef | undefined {
  return PLUGINS.find((p) => p.id === id);
}

export function pluginForRoute(path: string): PluginDef | undefined {
  return PLUGINS.find((p) => p.routes.some((r) => r !== "/" && path.startsWith(r)));
}

export const ALL_PERMISSIONS = Array.from(
  new Set([...PLUGINS.flatMap((p) => p.permissions), "plugins.manage", "users.manage", "settings.manage"]),
).sort();

export const ASSIGNABLE_ROLES = ["staff", "volunteer", "member"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
