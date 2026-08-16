// Netflix-style browse rows + "My List" server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type BrowseItem = {
  id: string;
  title: string;
  thumbnail: string;
  collectionId: string | null;
};

export const getBrowseRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    const { bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(supabase);

    const [{ data: cols }, { data: vids }] = await Promise.all([
      supabase.from("collections").select("id, name").order("name"),
      supabase
        .from("video_metadata")
        .select("bunny_video_id, title, collection_id, created_at, sort_order")
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    const all: BrowseItem[] = (vids ?? []).map((v) => ({
      id: v.bunny_video_id,
      title: v.title,
      collectionId: v.collection_id,
      thumbnail: bunnySignedThumbnailUrl(v.bunny_video_id),
    }));

    const rows = [
      { id: "new", name: "New releases", items: all.slice(0, 14) },
      ...(cols ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        items: all.filter((v) => v.collectionId === c.id).slice(0, 14),
      })),
      { id: "uncat", name: "Unsorted", items: all.filter((v) => !v.collectionId).slice(0, 14) },
    ].filter((r) => r.items.length > 0);

    const hero = all[0] ?? null;
    return { hero, rows, total: all.length };
  });

export const getMyList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    const { bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(supabase);

    const { data: pl } = await supabase
      .from("playlists")
      .select("id")
      .eq("user_id", userId)
      .eq("is_watch_later", true)
      .maybeSingle();
    if (!pl) return [] as (BrowseItem & { addedAt: string })[];

    const { data: items } = await supabase
      .from("playlist_items")
      .select("bunny_video_id, added_at")
      .eq("playlist_id", pl.id)
      .order("added_at", { ascending: false });
    const ids = (items ?? []).map((i) => i.bunny_video_id);
    if (!ids.length) return [] as (BrowseItem & { addedAt: string })[];

    const { data: meta } = await supabase
      .from("video_metadata")
      .select("bunny_video_id, title, collection_id")
      .in("bunny_video_id", ids);
    const map = new Map((meta ?? []).map((m) => [m.bunny_video_id, m]));
    return (items ?? [])
      .filter((i) => map.has(i.bunny_video_id))
      .map((i) => {
        const m = map.get(i.bunny_video_id)!;
        return {
          id: m.bunny_video_id,
          title: m.title,
          collectionId: m.collection_id,
          thumbnail: bunnySignedThumbnailUrl(m.bunny_video_id),
          addedAt: i.added_at as string,
        };
      });
  });

export const isInMyList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pl } = await supabase
      .from("playlists")
      .select("id")
      .eq("user_id", userId)
      .eq("is_watch_later", true)
      .maybeSingle();
    if (!pl) return { saved: false };
    const { data: row } = await supabase
      .from("playlist_items")
      .select("bunny_video_id")
      .eq("playlist_id", pl.id)
      .eq("bunny_video_id", data.videoId)
      .maybeSingle();
    return { saved: !!row };
  });
