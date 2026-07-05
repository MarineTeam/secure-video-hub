import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireViewer, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_library",
  title: "List video library",
  description: "List videos in the portal library visible to the signed-in approved viewer.",
  inputSchema: {
    query: z.string().max(200).optional().describe("Optional case-insensitive title search."),
    collectionId: z.string().uuid().optional().describe("Optional collection UUID to filter by."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, collectionId, limit }, ctx) => {
    try {
      const supabase = await requireViewer(ctx);
      let q = supabase
        .from("video_metadata")
        .select("bunny_video_id, title, collection_id, created_at")
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (query) q = q.ilike("title", `%${query}%`);
      if (collectionId) q = q.eq("collection_id", collectionId);
      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return textResult(data ?? []);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
