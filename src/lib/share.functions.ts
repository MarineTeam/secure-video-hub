// Share-link server functions.
// Two access modes:
//  - "email": recipient must sign in with the invited email (member or guest).
//  - "public": anyone with the link can watch, optionally password protected.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(20).max(200) });

// Public: describe the link so the page knows what to render.
export const validateShareToken = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("share_links")
      .select("id, bunny_video_id, recipient_email, expires_at, viewed_at, revoked_at, access_mode, password_hash, max_views, view_count, label")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.revoked_at) return { ok: false as const, reason: "revoked" as const };
    if (new Date(row.expires_at) < new Date()) return { ok: false as const, reason: "expired" as const };
    if (row.max_views != null && row.view_count >= row.max_views) {
      return { ok: false as const, reason: "exhausted" as const };
    }
    const { data: meta } = await supabaseAdmin
      .from("video_metadata")
      .select("title")
      .eq("bunny_video_id", row.bunny_video_id)
      .maybeSingle();
    return {
      ok: true as const,
      accessMode: row.access_mode as "email" | "public",
      needsPassword: !!row.password_hash,
      recipientEmail: row.recipient_email,
      label: row.label,
      title: meta?.title ?? "Shared video",
    };
  });

// Public shares: no account required. Password checked server-side when set.
export const openPublicShare = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenSchema.extend({ password: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bunnySignedEmbedUrl } = await import("@/lib/bunny.server");
    const { verifySharePassword } = await import("@/lib/share.server");
    const { data: row } = await supabaseAdmin
      .from("share_links")
      .select("id, bunny_video_id, expires_at, revoked_at, access_mode, password_hash, password_salt, max_views, view_count")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Share not found");
    if (row.access_mode !== "public") throw new Error("This link requires signing in");
    if (row.revoked_at) throw new Error("Share revoked");
    if (new Date(row.expires_at) < new Date()) throw new Error("Share expired");
    if (row.max_views != null && row.view_count >= row.max_views) throw new Error("This link has reached its view limit");
    if (row.password_hash) {
      if (!data.password) throw new Error("Password required");
      if (!verifySharePassword(data.password, row.password_hash, row.password_salt ?? "")) {
        throw new Error("Incorrect password");
      }
    }
    await supabaseAdmin
      .from("share_links")
      .update({ viewed_at: row.view_count === 0 ? new Date().toISOString() : undefined, view_count: row.view_count + 1 })
      .eq("id", row.id);
    const { data: meta } = await supabaseAdmin
      .from("video_metadata")
      .select("title")
      .eq("bunny_video_id", row.bunny_video_id)
      .maybeSingle();
    return { url: bunnySignedEmbedUrl(row.bunny_video_id), title: meta?.title ?? "Shared video" };
  });

// Email shares: caller must be signed in as the invited address (guests welcome —
// they do not need to be an approved member).
export const openShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const email = ((context.claims as { email?: string }).email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bunnySignedEmbedUrl } = await import("@/lib/bunny.server");
    const { data: row } = await supabaseAdmin
      .from("share_links")
      .select("id, bunny_video_id, recipient_email, expires_at, revoked_at, access_mode, max_views, view_count")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Share not found");
    if (row.revoked_at) throw new Error("Share revoked");
    if (new Date(row.expires_at) < new Date()) throw new Error("Share expired");
    if (row.max_views != null && row.view_count >= row.max_views) throw new Error("This link has reached its view limit");
    if (row.access_mode === "email") {
      const recipient = (row.recipient_email ?? "").toLowerCase();
      if (!recipient || recipient !== email) throw new Error("This share is for a different email");
    }
    await supabaseAdmin
      .from("share_links")
      .update({ viewed_at: row.view_count === 0 ? new Date().toISOString() : undefined, view_count: row.view_count + 1 })
      .eq("id", row.id);
    const { data: meta } = await supabaseAdmin
      .from("video_metadata")
      .select("title")
      .eq("bunny_video_id", row.bunny_video_id)
      .maybeSingle();
    return { url: bunnySignedEmbedUrl(row.bunny_video_id), title: meta?.title ?? "Shared video" };
  });

// ---------------- Member sharing ----------------

export const getMySharePrivileges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: canShare }, { data: canPublic }] = await Promise.all([
      supabase.rpc("can_share", { _user_id: userId }),
      supabase.rpc("can_share_public", { _user_id: userId }),
    ]);
    return { canShare: !!canShare, canSharePublic: !!canPublic };
  });

const createSchema = z.object({
  videoId: z.string().min(4).max(200),
  accessMode: z.enum(["email", "public"]).default("email"),
  recipientEmail: z.string().email().max(320).optional().nullable(),
  password: z.string().min(4).max(200).optional().nullable(),
  label: z.string().max(120).optional().nullable(),
  maxViews: z.number().int().min(1).max(10000).optional().nullable(),
  ttlHours: z.number().int().min(1).max(24 * 90).default(72),
});

export const createMyShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: canShare } = await supabase.rpc("can_share", { _user_id: userId });
    if (!canShare) throw new Error("You do not have permission to create share links");
    if (data.accessMode === "public") {
      const { data: canPublic } = await supabase.rpc("can_share_public", { _user_id: userId });
      if (!canPublic) throw new Error("You do not have permission to create public links");
    }
    if (data.accessMode === "email" && !data.recipientEmail) throw new Error("Recipient email required");

    const { generateShareToken } = await import("@/lib/bunny.server");
    const { hashSharePassword } = await import("@/lib/share.server");
    const { auditLog } = await import("@/lib/admin.server");
    const token = generateShareToken();
    const expiresAt = new Date(Date.now() + data.ttlHours * 3600 * 1000);
    const pw = data.password ? hashSharePassword(data.password) : null;

    const { data: row, error } = await supabase
      .from("share_links")
      .insert({
        token,
        bunny_video_id: data.videoId,
        recipient_email: data.accessMode === "email" ? data.recipientEmail!.toLowerCase() : null,
        access_mode: data.accessMode,
        password_hash: pw?.hash ?? null,
        password_salt: pw?.salt ?? null,
        label: data.label?.trim() || null,
        max_views: data.maxViews ?? null,
        expires_at: expiresAt.toISOString(),
        created_by: userId,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);

    const email = (context.claims as { email?: string }).email ?? null;
    await auditLog(supabase, { id: userId, email }, "share.create", row.id, {
      mode: data.accessMode,
      recipient: data.recipientEmail ?? null,
      videoId: data.videoId,
    });

    if (data.accessMode === "email" && data.recipientEmail) {
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
    }
    return { id: row.id, token };
  });

export const listMyShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("share_links")
      .select("id, token, bunny_video_id, recipient_email, access_mode, label, expires_at, viewed_at, revoked_at, created_at, view_count, max_views, password_hash")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r) => r.bunny_video_id))];
    const titles = new Map<string, string>();
    if (ids.length) {
      const { data: meta } = await supabase.from("video_metadata").select("bunny_video_id, title").in("bunny_video_id", ids);
      (meta ?? []).forEach((m) => titles.set(m.bunny_video_id, m.title));
    }
    return rows.map((r) => ({
      id: r.id,
      token: r.token,
      videoId: r.bunny_video_id,
      title: titles.get(r.bunny_video_id) ?? "Video",
      recipientEmail: r.recipient_email,
      accessMode: r.access_mode as "email" | "public",
      label: r.label,
      hasPassword: !!r.password_hash,
      expiresAt: r.expires_at,
      viewedAt: r.viewed_at,
      revokedAt: r.revoked_at,
      createdAt: r.created_at,
      viewCount: r.view_count,
      maxViews: r.max_views,
    }));
  });

export const revokeMyShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("created_by", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
