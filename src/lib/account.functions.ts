// Account-level server functions (self-service deletion).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const email = (context.claims as { email?: string }).email ?? null;
    const { auditLog } = await import("@/lib/admin.server");
    await auditLog(supabase, { id: userId, email }, "account.delete", email ?? userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Owned content that has no cascade path.
    await supabaseAdmin.from("video_comments").delete().eq("user_id", userId);
    await supabaseAdmin.from("video_likes").delete().eq("user_id", userId);
    await supabaseAdmin.from("watch_progress").delete().eq("user_id", userId);
    await supabaseAdmin.from("video_views").delete().eq("user_id", userId);
    await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
    await supabaseAdmin.from("collection_subscriptions").delete().eq("user_id", userId);
    await supabaseAdmin.from("playlists").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    await supabaseAdmin.from("share_privileges").delete().eq("user_id", userId);
    if (email) await supabaseAdmin.from("approved_viewers").delete().eq("email", email);
    // Revoke any links they created so nothing keeps working after deletion.
    await supabaseAdmin
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("created_by", userId)
      .is("revoked_at", null);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
