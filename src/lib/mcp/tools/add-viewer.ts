import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin, textResult, errorResult, auditLog } from "../supabase";

export default defineTool({
  name: "add_viewer",
  title: "Add approved viewer",
  description: "Admin only. Grant an email address access to the video library.",
  inputSchema: {
    email: z.string().email().max(320).describe("Email address to approve."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ email }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const normalized = email.trim().toLowerCase();
      const { error } = await supabase
        .from("approved_viewers")
        .upsert({ email: normalized, added_by: ctx.getUserId() }, { onConflict: "email", ignoreDuplicates: true });
      if (error) return errorResult(error.message);
      await auditLog(supabase, ctx, "viewers.add", undefined, { emails: [normalized] });
      return textResult({ ok: true, email: normalized });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
