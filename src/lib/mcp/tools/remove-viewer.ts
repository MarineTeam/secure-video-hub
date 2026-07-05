import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin, textResult, errorResult, auditLog } from "../supabase";

export default defineTool({
  name: "remove_viewer",
  title: "Remove approved viewer",
  description: "Admin only. Revoke library access for an email address.",
  inputSchema: {
    email: z.string().email().max(320).describe("Email address to remove."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ email }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const normalized = email.trim().toLowerCase();
      const { error } = await supabase.from("approved_viewers").delete().eq("email", normalized);
      if (error) return errorResult(error.message);
      await auditLog(supabase, ctx, "viewer.remove", normalized);
      return textResult({ ok: true, email: normalized });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
