// Admin server functions: videos, viewers, shares, settings, collections, activity, analytics.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string; claims: unknown }) {
  const { assertAdmin, auditLog } = await import("@/lib/admin.server");
  await assertAdmin(context.supabase, context.userId);
  const email = (context.claims as { email?: string }).email ?? null;
  return {
    actor: { id: context.userId, email },
    audit: (action: string, target?: string, meta?: Record<string, unknown>) =>
      auditLog(context.supabase, { id: context.userId, email }, action, target, meta ?? {}),
  };
}

// ---------------- Videos & Collections ----------------

export const listAdminVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { bunnyListVideos } = await import("@/lib/bunny.server");
    const [{ items: bunnyItems }, { data: meta }, { data: cols }] = await Promise.all([
      bunnyListVideos({ itemsPerPage: 500, orderBy: "date" }),
      context.supabase.from("video_metadata").select("bunny_video_id, sort_order, collection_id, title"),
      context.supabase.from("collections").select("id, name"),
    ]);
    const metaMap = new Map((meta ?? []).map((m) => [m.bunny_video_id, m]));
    return {
      videos: bunnyItems.map((b) => ({
        id: b.guid,
        title: metaMap.get(b.guid)?.title ?? b.title,
        status: b.status,
        encodeProgress: b.encodeProgress,
        length: b.length,
        views: b.views,
        dateUploaded: b.dateUploaded,
        collectionId: metaMap.get(b.guid)?.collection_id ?? null,
        sortOrder: metaMap.get(b.guid)?.sort_order ?? 0,
      })),
      collections: cols ?? [],
    };
  });

export const syncBunnyLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { audit } = await admin(context);
    const { bunnyListVideos } = await import("@/lib/bunny.server");
    const { items } = await bunnyListVideos({ itemsPerPage: 500 });
    // Upsert metadata for each
    for (const v of items) {
      await context.supabase
        .from("video_metadata")
        .upsert({ bunny_video_id: v.guid, title: v.title }, { onConflict: "bunny_video_id" });
    }
    await audit("videos.sync", undefined, { count: items.length });
    return { count: items.length };
  });

export const renameVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string(), title: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    const { bunnyUpdateVideo } = await import("@/lib/bunny.server");
    await bunnyUpdateVideo(data.id, { title: data.title });
    await context.supabase.from("video_metadata").upsert({ bunny_video_id: data.id, title: data.title });
    await audit("video.rename", data.id, { title: data.title });
    return { ok: true };
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    const { bunnyDeleteVideo } = await import("@/lib/bunny.server");
    await bunnyDeleteVideo(data.id);
    await context.supabase.from("video_metadata").delete().eq("bunny_video_id", data.id);
    await audit("video.delete", data.id);
    return { ok: true };
  });

export const setVideoCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string(), collectionId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    await context.supabase
      .from("video_metadata")
      .upsert({ bunny_video_id: data.id, title: "", collection_id: data.collectionId }, { onConflict: "bunny_video_id" });
    await audit("video.set_collection", data.id, { collectionId: data.collectionId });
    return { ok: true };
  });

export const reorderVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order: z.array(z.string()).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    // Newest = highest sort_order
    const n = data.order.length;
    for (let i = 0; i < n; i++) {
      const id = data.order[i];
      await context.supabase
        .from("video_metadata")
        .upsert({ bunny_video_id: id, title: "", sort_order: n - i }, { onConflict: "bunny_video_id", ignoreDuplicates: false });
    }
    await audit("videos.reorder", undefined, { count: n });
    return { ok: true };
  });

export const createTusUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ title: z.string().min(1).max(300), collectionId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    const { bunnyCreateVideo, bunnyTusSignature } = await import("@/lib/bunny.server");
    const video = await bunnyCreateVideo(data.title, data.collectionId ?? undefined);
    await context.supabase
      .from("video_metadata")
      .upsert({ bunny_video_id: video.guid, title: data.title, collection_id: data.collectionId ?? null });
    const sig = bunnyTusSignature(video.guid);
    await audit("video.upload_create", video.guid, { title: data.title });
    return { video, sig };
  });

export const listCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { data } = await context.supabase.from("collections").select("id, name, created_at").order("name");
    return data ?? [];
  });

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    const { data: row, error } = await context.supabase
      .from("collections")
      .insert({ name: data.name, created_by: context.userId })
      .select()
      .single();
    if (error) throw error;
    await audit("collection.create", row.id, { name: data.name });
    return row;
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    await context.supabase.from("collections").delete().eq("id", data.id);
    await audit("collection.delete", data.id);
    return { ok: true };
  });

// ---------------- Viewers ----------------

export const listViewers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { data } = await context.supabase
      .from("approved_viewers")
      .select("id, email, added_at, last_seen_at")
      .order("added_at", { ascending: false });
    return data ?? [];
  });

export const addViewers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ emails: z.array(z.string().email().max(320)).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { actor, audit } = await admin(context);
    const rows = [...new Set(data.emails.map((e) => e.trim().toLowerCase()))].map((email) => ({
      email,
      added_by: actor.id,
    }));
    const { error } = await context.supabase
      .from("approved_viewers")
      .upsert(rows, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw error;
    await audit("viewers.add", undefined, { count: rows.length, emails: rows.map((r) => r.email) });
    // Trigger approval-notice email for each new viewer
    try {
      const { sendTransactionalEmail } = await import("@/lib/email/send");
      for (const r of rows) {
        await sendTransactionalEmail({
          templateName: "viewer-approved",
          recipientEmail: r.email,
          idempotencyKey: `viewer-approved-${r.email}`,
          templateData: { email: r.email },
        }).catch(() => {});
      }
    } catch {
      // email infra not scaffolded yet — silently skip
    }
    return { added: rows.length };
  });

export const removeViewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    const { data: row } = await context.supabase.from("approved_viewers").select("email").eq("id", data.id).maybeSingle();
    await context.supabase.from("approved_viewers").delete().eq("id", data.id);
    await audit("viewer.remove", row?.email ?? data.id);
    return { ok: true };
  });

// ---------------- Shares ----------------

export const listShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { data } = await context.supabase
      .from("share_links")
      .select("id, token, bunny_video_id, recipient_email, expires_at, viewed_at, revoked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const createShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        videoId: z.string().min(4).max(200),
        recipientEmail: z.string().email().max(320),
        ttlHours: z.number().int().min(1).max(24 * 30).default(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    const { generateShareToken } = await import("@/lib/bunny.server");
    const token = generateShareToken();
    const expiresAt = new Date(Date.now() + data.ttlHours * 3600 * 1000);
    const { data: row, error } = await context.supabase
      .from("share_links")
      .insert({
        token,
        bunny_video_id: data.videoId,
        recipient_email: data.recipientEmail.toLowerCase(),
        expires_at: expiresAt.toISOString(),
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    await audit("share.create", row.id, { recipient: data.recipientEmail, videoId: data.videoId });
    // Send invite email
    try {
      const { sendTransactionalEmail } = await import("@/lib/email/send");
      await sendTransactionalEmail({
        templateName: "share-invite",
        recipientEmail: data.recipientEmail,
        idempotencyKey: `share-${row.id}`,
        templateData: { token, expiresAt: expiresAt.toISOString() },
      }).catch(() => {});
    } catch {
      // email infra not scaffolded yet
    }
    return { id: row.id, token };
  });

export const revokeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    await context.supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    await audit("share.revoke", data.id);
    return { ok: true };
  });

// ---------------- Settings ----------------

export const getAllSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { data } = await context.supabase.from("settings").select("key, value");
    return (data ?? []) as Array<{ key: string; value: unknown }>;
  });

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ key: z.enum(["homepage_video_count", "palette", "idle_timeout_minutes"]), value: z.any() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { audit } = await admin(context);
    await context.supabase
      .from("settings")
      .upsert({ key: data.key, value: data.value as never, updated_by: context.userId, updated_at: new Date().toISOString() });
    await audit("settings.update", data.key, { value: data.value });
    return { ok: true };
  });

// ---------------- Audit + Analytics ----------------

export const getAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { data } = await context.supabase
      .from("audit_log")
      .select("id, actor_email, action, target, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { bunnyStatistics, bunnyListVideos } = await import("@/lib/bunny.server");
    try {
      const [stats, videos] = await Promise.all([bunnyStatistics(), bunnyListVideos({ itemsPerPage: 500 })]);
      const most = [...videos.items].sort((a, b) => b.views - a.views).slice(0, 10).map((v) => ({
        id: v.guid,
        title: v.title,
        views: v.views,
        length: v.length,
      }));
      const chart = Object.entries(stats.viewsChart ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, count]) => ({ date, views: count }));
      return {
        totalViews: stats.totalViewCount ?? 0,
        totalWatchSeconds: stats.totalWatchTime ?? 0,
        averageWatchSeconds: stats.averageWatchTime ?? 0,
        engagement: stats.engagementScore ?? 0,
        videoCount: videos.items.length,
        chart,
        most,
      };
    } catch (e) {
      return { totalViews: 0, totalWatchSeconds: 0, averageWatchSeconds: 0, engagement: 0, videoCount: 0, chart: [], most: [], error: (e as Error).message };
    }
  });
