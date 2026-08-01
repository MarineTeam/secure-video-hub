// Engagement: view tracking, trending, related videos.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const idSchema = z.object({ videoId: z.string().min(1).max(200) });

// Record one view (called once per watch-page load).
export const recordView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(supabase);
    // De-dupe: skip if this user already logged a view in the last 30 minutes.
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("video_views")
      .select("id")
      .eq("user_id", userId)
      .eq("bunny_video_id", data.videoId)
      .gt("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) return { recorded: false };
    await supabase.from("video_views").insert({ user_id: userId, bunny_video_id: data.videoId });
    return { recorded: true };
  });

const countsSchema = z.object({ ids: z.array(z.string().min(1).max(200)).max(200) });

export const getViewCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => countsSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return {} as Record<string, number>;
    const { data: rows } = await context.supabase.rpc("video_view_counts", { _ids: data.ids });
    const out: Record<string, number> = {};
    for (const r of rows ?? []) out[r.bunny_video_id] = Number(r.views);
    return out;
  });

const trendingSchema = z.object({ days: z.number().int().min(1).max(365).default(30), limit: z.number().int().min(1).max(24).default(8) });

export const getTrending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => trendingSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    const { bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(supabase);
    const { data: rows } = await supabase.rpc("top_videos", { _days: data.days, _limit: data.limit });
    const ids = (rows ?? []).map((r) => r.bunny_video_id);
    if (!ids.length) return [];
    const { data: meta } = await supabase.from("video_metadata").select("bunny_video_id, title").in("bunny_video_id", ids);
    const titles = new Map((meta ?? []).map((m) => [m.bunny_video_id, m.title]));
    return (rows ?? [])
      .filter((r) => titles.has(r.bunny_video_id))
      .map((r) => ({
        id: r.bunny_video_id,
        title: titles.get(r.bunny_video_id) as string,
        views: Number(r.views),
        thumbnail: bunnySignedThumbnailUrl(r.bunny_video_id),
      }));
  });

// "Up next": other videos in the same collection, then recent library items.
export const getRelatedVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    const { bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(supabase);

    const { data: current } = await supabase
      .from("video_metadata")
      .select("bunny_video_id, collection_id")
      .eq("bunny_video_id", data.videoId)
      .maybeSingle();

    const picked = new Map<string, { id: string; title: string }>();

    if (current?.collection_id) {
      const { data: same } = await supabase
        .from("video_metadata")
        .select("bunny_video_id, title")
        .eq("collection_id", current.collection_id)
        .neq("bunny_video_id", data.videoId)
        .order("sort_order", { ascending: false })
        .limit(10);
      for (const r of same ?? []) picked.set(r.bunny_video_id, { id: r.bunny_video_id, title: r.title });
    }

    if (picked.size < 10) {
      const { data: recent } = await supabase
        .from("video_metadata")
        .select("bunny_video_id, title")
        .neq("bunny_video_id", data.videoId)
        .order("created_at", { ascending: false })
        .limit(20);
      for (const r of recent ?? []) {
        if (picked.size >= 10) break;
        if (!picked.has(r.bunny_video_id)) picked.set(r.bunny_video_id, { id: r.bunny_video_id, title: r.title });
      }
    }

    return [...picked.values()].map((v) => ({ ...v, thumbnail: bunnySignedThumbnailUrl(v.id) }));
  });
