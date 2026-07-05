import { defineTool } from "@lovable.dev/mcp-js";
import { requireAdmin, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_shares",
  title: "List share links",
  description: "Admin only. List the most recent 100 share links, including their status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const { data, error } = await supabase
        .from("share_links")
        .select("id, token, bunny_video_id, recipient_email, expires_at, viewed_at, revoked_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return errorResult(error.message);
      return textResult(data ?? []);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
