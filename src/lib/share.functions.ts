// Share-link server function. Public (unauthenticated) validation on the token,
// but signed embed requires the caller to be authenticated as the recipient email.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(20).max(200) });

// Public: check token validity + return recipient email (so signed-out users
// see who the share is for and are prompted to sign in).
export const validateShareToken = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("share_links")
      .select("id, bunny_video_id, recipient_email, expires_at, viewed_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.revoked_at) return { ok: false as const, reason: "revoked" as const };
    if (new Date(row.expires_at) < new Date()) return { ok: false as const, reason: "expired" as const };
    const { data: meta } = await supabaseAdmin
      .from("video_metadata")
      .select("title")
      .eq("bunny_video_id", row.bunny_video_id)
      .maybeSingle();
    return {
      ok: true as const,
      recipientEmail: row.recipient_email,
      title: meta?.title ?? "Shared video",
    };
  });

// Authenticated: exchange share token for signed embed url, iff caller's email matches.
export const openShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const email = ((context.claims as { email?: string }).email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bunnySignedEmbedUrl } = await import("@/lib/bunny.server");
    const { data: row } = await supabaseAdmin
      .from("share_links")
      .select("id, bunny_video_id, recipient_email, expires_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Share not found");
    if (row.revoked_at) throw new Error("Share revoked");
    if (new Date(row.expires_at) < new Date()) throw new Error("Share expired");
    if (row.recipient_email.toLowerCase() !== email) throw new Error("This share is for a different email");
    // mark viewed
    if (!row) throw new Error("Share not found");
    await supabaseAdmin
      .from("share_links")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("viewed_at", null);
    const { data: meta } = await supabaseAdmin
      .from("video_metadata")
      .select("title")
      .eq("bunny_video_id", row.bunny_video_id)
      .maybeSingle();
    return { url: bunnySignedEmbedUrl(row.bunny_video_id), title: meta?.title ?? "Shared video" };
  });
