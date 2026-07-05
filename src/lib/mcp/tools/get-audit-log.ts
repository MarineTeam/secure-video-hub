import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "get_audit_log",
  title: "Get audit log",
  description: "Admin only. Return recent audit-log entries for admin activity across the portal.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, actor_email, action, target, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return errorResult(error.message);
      return textResult(data ?? []);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
