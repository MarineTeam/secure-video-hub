import { defineTool } from "@lovable.dev/mcp-js";
import { requireAdmin, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_viewers",
  title: "List approved viewers",
  description: "Admin only. List all approved viewers with when they were added and last seen.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const { data, error } = await supabase
        .from("approved_viewers")
        .select("id, email, added_at, last_seen_at")
        .order("added_at", { ascending: false });
      if (error) return errorResult(error.message);
      return textResult(data ?? []);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
