import { defineTool } from "@lovable.dev/mcp-js";
import { requireViewer, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "continue_watching",
  title: "Continue watching",
  description: "List videos the signed-in viewer has started but not finished.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      const supabase = await requireViewer(ctx);
      const { data, error } = await supabase
        .from("watch_progress")
        .select("bunny_video_id, position_seconds, duration_seconds, updated_at")
        .eq("user_id", ctx.getUserId())
        .gt("position_seconds", 5)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) return errorResult(error.message);
      return textResult(data ?? []);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
