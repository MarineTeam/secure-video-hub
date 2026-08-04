// Public/viewer server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Get current user's auth state + role + approval, for header/routing.
export const getSessionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email ?? null;
    const [{ data: isAdmin }, { data: isViewer }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("is_approved_viewer"),
    ]);
    // Best-effort last-seen bump
    if (email && isViewer) {
      await supabase.from("approved_viewers").update({ last_seen_at: new Date().toISOString() }).eq("email", email);
    }
    return { userId, email, isAdmin: !!isAdmin, isApproved: !!isViewer };
  });

// Sync ADMIN_EMAILS env into settings so DB trigger promotes matching signups.
// Called client-side on every visit (cheap upsert). Also grants role to any
// already-existing user whose email is in the list.
export const syncAdminEmails = createServerFn({ method: "POST" }).handler(async () => {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("settings")
    .upsert({ key: "admin_emails", value: emails as unknown as never, updated_at: new Date().toISOString() });
  // Promote existing users
  if (emails.length) {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users?.users ?? []) {
      const em = (u.email ?? "").toLowerCase();
      if (em && emails.includes(em)) {
        await supabaseAdmin.from("user_roles").upsert({ user_id: u.id, role: "admin" }, { onConflict: "user_id,role" });
        await supabaseAdmin.from("approved_viewers").upsert({ email: em, added_by: u.id }, { onConflict: "email" });
      }
    }
  }
  return { ok: true, count: emails.length };
});

export const getPaletteSetting = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "palette").maybeSingle();
  const raw = data?.value;
  return { palette: typeof raw === "string" ? raw : "ocean" };
});

// Library page for approved viewers.
const listSchema = z.object({
  q: z.string().max(200).optional(),
  collectionId: z.string().uuid().nullable().optional(),
  page: z.number().int().min(1).max(500).default(1),
});

export const getLibraryPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    const { bunnyGetVideo, bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(supabase);

    const { data: countRow } = await supabase.from("settings").select("value").eq("key", "homepage_video_count").maybeSingle();
    const perPage = Math.min(Number(countRow?.value ?? 24), 100);

    let query = supabase
      .from("video_metadata")
      .select("bunny_video_id, title, collection_id, sort_order, created_at", { count: "exact" })
      .order("sort_order", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.q) query = query.ilike("title", `%${data.q}%`);
    if (data.collectionId) query = query.eq("collection_id", data.collectionId);
    const from = (data.page - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data: rows, count } = await query;
    const items = await Promise.all(
      (rows ?? []).map(async (r) => {
        let length = 0;
        let status = 4;
        try {
          const bv = await bunnyGetVideo(r.bunny_video_id);
          length = bv.length;
          status = bv.status;
        } catch {
          // ignore missing bunny video
        }
        return {
          id: r.bunny_video_id,
          title: r.title,
          collectionId: r.collection_id,
          thumbnail: bunnySignedThumbnailUrl(r.bunny_video_id),
          length,
          status,
        };
      }),
    );
    return { items, total: count ?? items.length, perPage, page: data.page };
  });

// Lightweight title search for the command palette.
export const searchVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const term = data.q.trim();
    if (term.length < 2) return [] as { id: string; title: string; collection: string | null }[];
    const { data: rows } = await context.supabase
      .from("video_metadata")
      .select("bunny_video_id, title, collections(name)")
      .ilike("title", `%${term}%`)
      .limit(12);
    return (rows ?? []).map((r) => ({
      id: r.bunny_video_id,
      title: r.title,
      collection: (r as unknown as { collections?: { name: string } }).collections?.name ?? null,
    }));
  });

export const listCollectionsForViewer = createServerFn({ method: "GET" })

  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const { data } = await context.supabase.from("collections").select("id, name").order("name");
    return data ?? [];
  });

export const getContinueWatching = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    const { bunnySignedThumbnailUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(supabase);
    const { data } = await supabase
      .from("watch_progress")
      .select("bunny_video_id, position_seconds, duration_seconds, updated_at")
      .eq("user_id", userId)
      .gt("position_seconds", 5)
      .order("updated_at", { ascending: false })
      .limit(10);
    const ids = (data ?? []).map((r) => r.bunny_video_id);
    if (!ids.length) return [];
    const { data: meta } = await supabase
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
      }));
  });
