// Social / YouTube-style server functions for approved viewers.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const vid = z.string().min(4).max(200);

// ----------------------------------------------------------
// LIKES
// ----------------------------------------------------------
export const getLikeState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ count }, { data: mine }] = await Promise.all([
      supabase
        .from("video_likes")
        .select("user_id", { count: "exact", head: true })
        .eq("bunny_video_id", data.videoId),
      supabase
        .from("video_likes")
        .select("user_id")
        .eq("bunny_video_id", data.videoId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return { count: count ?? 0, liked: !!mine };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(supabase);
    const { data: existing } = await supabase
      .from("video_likes")
      .select("user_id")
      .eq("bunny_video_id", data.videoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabase.from("video_likes").delete().eq("bunny_video_id", data.videoId).eq("user_id", userId);
      return { liked: false };
    }
    await supabase.from("video_likes").insert({ bunny_video_id: data.videoId, user_id: userId });
    return { liked: true };
  });

// ----------------------------------------------------------
// COMMENTS
// ----------------------------------------------------------
export const listComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(supabase);
    const { data: rows } = await supabase
      .from("video_comments")
      .select("id, user_id, parent_id, body, deleted, created_at, updated_at")
      .eq("bunny_video_id", data.videoId)
      .order("created_at", { ascending: true })
      .limit(500);
    // Resolve emails via admin listUsers (best-effort cache).
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const emailMap = new Map<string, string>();
    if (userIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of users?.users ?? []) if (u.email) emailMap.set(u.id, u.email);
    }
    return (rows ?? []).map((r) => ({
      ...r,
      author: emailMap.get(r.user_id) ?? "Viewer",
      body: r.deleted ? "[deleted]" : r.body,
    }));
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ videoId: vid, body: z.string().min(1).max(4000), parentId: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertApprovedViewer, rateLimit } = await import("@/lib/admin.server");
    await assertApprovedViewer(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ok = await rateLimit(supabaseAdmin, "comment", userId, 30, 60);
    if (!ok) throw new Error("Slow down — too many comments.");
    const { data: row, error } = await supabase
      .from("video_comments")
      .insert({
        bunny_video_id: data.videoId,
        user_id: userId,
        parent_id: data.parentId ?? null,
        body: data.body.trim(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Soft-delete: keep tree structure.
    const { error } = await context.supabase
      .from("video_comments")
      .update({ deleted: true, body: "" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------------------------------------------------
// PLAYLISTS
// ----------------------------------------------------------
async function ensureWatchLater(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("playlists")
    .select("id")
    .eq("user_id", userId)
    .eq("is_watch_later", true)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: made, error } = await supabase
    .from("playlists")
    .insert({ user_id: userId, name: "Watch Later", is_watch_later: true })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return made.id;
}

export const listPlaylists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    await ensureWatchLater(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("playlists")
      .select("id, name, description, is_watch_later, created_at, updated_at")
      .order("is_watch_later", { ascending: false })
      .order("updated_at", { ascending: false });
    // Item counts
    const ids = (data ?? []).map((p) => p.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: items } = await context.supabase
        .from("playlist_items")
        .select("playlist_id")
        .in("playlist_id", ids);
      for (const r of items ?? []) counts.set(r.playlist_id, (counts.get(r.playlist_id) ?? 0) + 1);
    }
    return (data ?? []).map((p) => ({ ...p, itemCount: counts.get(p.id) ?? 0 }));
  });

export const createPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(120), description: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const { data: row, error } = await context.supabase
      .from("playlists")
      .insert({ user_id: context.userId, name: data.name, description: data.description ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Guard: don't delete Watch Later
    const { data: p } = await context.supabase.from("playlists").select("is_watch_later").eq("id", data.id).maybeSingle();
    if (p?.is_watch_later) throw new Error("Watch Later can't be deleted");
    const { error } = await context.supabase.from("playlists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const { bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    const { data: p, error } = await context.supabase
      .from("playlists")
      .select("id, name, description, is_watch_later, user_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: items } = await context.supabase
      .from("playlist_items")
      .select("bunny_video_id, position, added_at")
      .eq("playlist_id", data.id)
      .order("position", { ascending: true })
      .order("added_at", { ascending: true });
    const ids = (items ?? []).map((i) => i.bunny_video_id);
    const meta = new Map<string, string>();
    if (ids.length) {
      const { data: rows } = await context.supabase
        .from("video_metadata")
        .select("bunny_video_id, title")
        .in("bunny_video_id", ids);
      for (const r of rows ?? []) meta.set(r.bunny_video_id, r.title);
    }
    return {
      playlist: p,
      items: (items ?? []).map((i) => ({
        id: i.bunny_video_id,
        title: meta.get(i.bunny_video_id) ?? "Untitled",
        thumbnail: bunnySignedThumbnailUrl(i.bunny_video_id),
        position: i.position,
      })),
    };
  });

export const addToPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ playlistId: z.string().uuid(), videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("playlist_items")
      .upsert(
        { playlist_id: data.playlistId, bunny_video_id: data.videoId, position: 0 },
        { onConflict: "playlist_id,bunny_video_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeFromPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ playlistId: z.string().uuid(), videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("playlist_items")
      .delete()
      .eq("playlist_id", data.playlistId)
      .eq("bunny_video_id", data.videoId);
    return { ok: true };
  });

export const toggleWatchLater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const pid = await ensureWatchLater(context.supabase, context.userId);
    const { data: existing } = await context.supabase
      .from("playlist_items")
      .select("bunny_video_id")
      .eq("playlist_id", pid)
      .eq("bunny_video_id", data.videoId)
      .maybeSingle();
    if (existing) {
      await context.supabase
        .from("playlist_items")
        .delete()
        .eq("playlist_id", pid)
        .eq("bunny_video_id", data.videoId);
      return { saved: false };
    }
    await context.supabase.from("playlist_items").insert({ playlist_id: pid, bunny_video_id: data.videoId, position: 0 });
    return { saved: true };
  });

// ----------------------------------------------------------
// SUBSCRIPTIONS
// ----------------------------------------------------------
export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const { data } = await context.supabase
      .from("collection_subscriptions")
      .select("collection_id, notify, created_at, collections(id, name)")
      .eq("user_id", context.userId);
    return (data ?? []).map((r) => ({
      collectionId: r.collection_id,
      notify: r.notify,
      name: (r as unknown as { collections?: { name: string } }).collections?.name ?? "Collection",
    }));
  });

export const toggleSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ collectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const { data: existing } = await context.supabase
      .from("collection_subscriptions")
      .select("collection_id")
      .eq("user_id", context.userId)
      .eq("collection_id", data.collectionId)
      .maybeSingle();
    if (existing) {
      await context.supabase
        .from("collection_subscriptions")
        .delete()
        .eq("user_id", context.userId)
        .eq("collection_id", data.collectionId);
      return { subscribed: false };
    }
    await context.supabase.from("collection_subscriptions").insert({
      user_id: context.userId,
      collection_id: data.collectionId,
      notify: true,
    });
    return { subscribed: true };
  });

// ----------------------------------------------------------
// NOTIFICATIONS
// ----------------------------------------------------------
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("id, type, bunny_video_id, collection_id, title, body, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const unreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { count: count ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const q = context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", context.userId);
    if (data.ids && data.ids.length) await q.in("id", data.ids);
    else await q.is("read_at", null);
    return { ok: true };
  });

// ----------------------------------------------------------
// HISTORY (full watch history page)
// ----------------------------------------------------------
export const getWatchHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    const { bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(context.supabase);
    const { data } = await context.supabase
      .from("watch_progress")
      .select("bunny_video_id, position_seconds, duration_seconds, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    const ids = (data ?? []).map((r) => r.bunny_video_id);
    if (!ids.length) return [];
    const { data: meta } = await context.supabase
      .from("video_metadata")
      .select("bunny_video_id, title")
      .in("bunny_video_id", ids);
    const titleMap = new Map((meta ?? []).map((m) => [m.bunny_video_id, m.title]));
    return (data ?? [])
      .filter((r) => titleMap.has(r.bunny_video_id))
      .map((r) => ({
        id: r.bunny_video_id,
        title: titleMap.get(r.bunny_video_id) ?? "Untitled",
        thumbnail: bunnySignedThumbnailUrl(r.bunny_video_id),
        position: Number(r.position_seconds),
        duration: Number(r.duration_seconds),
        updatedAt: r.updated_at,
      }));
  });

export const clearWatchHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("watch_progress").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const removeHistoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("watch_progress")
      .delete()
      .eq("user_id", context.userId)
      .eq("bunny_video_id", data.videoId);
    return { ok: true };
  });

// Info for the watch page: which collection is this video in, so we can offer subscribe.
export const getVideoContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase
      .from("video_metadata")
      .select("bunny_video_id, title, collection_id, collections(id, name)")
      .eq("bunny_video_id", data.videoId)
      .maybeSingle();
    let subscribed = false;
    if (v?.collection_id) {
      const { data: s } = await context.supabase
        .from("collection_subscriptions")
        .select("collection_id")
        .eq("user_id", context.userId)
        .eq("collection_id", v.collection_id)
        .maybeSingle();
      subscribed = !!s;
    }
    return {
      collection: v?.collection_id
        ? { id: v.collection_id, name: (v as unknown as { collections?: { name: string } }).collections?.name ?? "Collection" }
        : null,
      subscribed,
    };
  });
