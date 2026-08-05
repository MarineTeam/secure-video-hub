// Admin analytics: views over time, top videos, most active viewers.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeSchema = z.object({ days: z.number().int().min(1).max(365).default(30) });

export const getAdminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86400000);

    const { data: views } = await context.supabase
      .from("video_views")
      .select("bunny_video_id, user_id, created_at")
      .gt("created_at", since.toISOString())
      .limit(50000);

    const rows = views ?? [];

    // Views per day, zero-filled.
    const byDay = new Map<string, number>();
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      byDay.set(d, 0);
    }
    const byVideo = new Map<string, number>();
    const byUser = new Map<string, number>();
    for (const r of rows) {
      const day = String(r.created_at).slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
      byVideo.set(r.bunny_video_id, (byVideo.get(r.bunny_video_id) ?? 0) + 1);
      byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1);
    }

    const topVideoIds = [...byVideo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const titles = new Map<string, string>();
    if (topVideoIds.length) {
      const { data: meta } = await context.supabase
        .from("video_metadata")
        .select("bunny_video_id, title")
        .in("bunny_video_id", topVideoIds.map(([id]) => id));
      for (const m of meta ?? []) titles.set(m.bunny_video_id, m.title);
    }

    const topUserIds = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const names = new Map<string, string>();
    if (topUserIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", topUserIds.map(([id]) => id));
      for (const p of profs ?? []) if (p.display_name) names.set(p.id, p.display_name);
    }

    const [{ count: viewerCount }, { count: videoCount }, { count: commentCount }] = await Promise.all([
      context.supabase.from("approved_viewers").select("id", { count: "exact", head: true }),
      context.supabase.from("video_metadata").select("bunny_video_id", { count: "exact", head: true }),
      context.supabase.from("video_comments").select("id", { count: "exact", head: true }).eq("deleted", false),
    ]);

    return {
      days: data.days,
      totalViews: rows.length,
      uniqueViewers: byUser.size,
      viewerCount: viewerCount ?? 0,
      videoCount: videoCount ?? 0,
      commentCount: commentCount ?? 0,
      series: [...byDay.entries()].map(([date, count]) => ({ date, count })),
      topVideos: topVideoIds.map(([id, count]) => ({ id, title: titles.get(id) ?? id, count })),
      topViewers: topUserIds.map(([id, count]) => ({ id, name: names.get(id) ?? `${id.slice(0, 8)}…`, count })),
    };
  });
