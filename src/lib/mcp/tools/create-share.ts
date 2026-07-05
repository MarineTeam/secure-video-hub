import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin, textResult, errorResult, auditLog } from "../supabase";

export default defineTool({
  name: "create_share",
  title: "Create share link",
  description:
    "Admin only. Create a time-limited share link for a video and email recipient. Returns the token that plugs into /s/<token>.",
  inputSchema: {
    videoId: z.string().min(4).max(200).describe("Bunny video ID (guid)."),
    recipientEmail: z.string().email().max(320),
    ttlHours: z.number().int().min(1).max(24 * 30).default(72),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ videoId, recipientEmail, ttlHours }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const { generateShareToken } = await import("@/lib/bunny.server");
      const token = generateShareToken();
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
      const { data, error } = await supabase
        .from("share_links")
        .insert({
          token,
          bunny_video_id: videoId,
          recipient_email: recipientEmail.toLowerCase(),
          expires_at: expiresAt.toISOString(),
          created_by: ctx.getUserId(),
        })
        .select("id, token, expires_at")
        .single();
      if (error) return errorResult(error.message);
      await auditLog(supabase, ctx, "share.create", data.id, { recipient: recipientEmail, videoId });
      try {
        const { sendTransactionalEmail } = await import("@/lib/email/send");
        await sendTransactionalEmail({
          templateName: "share-invite",
          recipientEmail,
          idempotencyKey: `share-${data.id}`,
          templateData: { token, expiresAt: expiresAt.toISOString() },
        }).catch(() => {});
      } catch {
        // email infra optional
      }
      return textResult(data);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
