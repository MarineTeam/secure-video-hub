import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin, textResult, errorResult, auditLog } from "../supabase";

export default defineTool({
  name: "revoke_share",
  title: "Revoke share link",
  description: "Admin only. Immediately revoke a share link by ID so it can no longer be used.",
  inputSchema: {
    id: z.string().uuid().describe("Share link ID."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const { error } = await supabase
        .from("share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return errorResult(error.message);
      await auditLog(supabase, ctx, "share.revoke", id);
      return textResult({ ok: true, id });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
