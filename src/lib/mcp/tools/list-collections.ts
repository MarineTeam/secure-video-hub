import { defineTool } from "@lovable.dev/mcp-js";
import { requireViewer, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_collections",
  title: "List collections",
  description: "List all video collections the signed-in approved viewer can see.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      const supabase = await requireViewer(ctx);
      const { data, error } = await supabase.from("collections").select("id, name").order("name");
      if (error) return errorResult(error.message);
      return textResult(data ?? []);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
