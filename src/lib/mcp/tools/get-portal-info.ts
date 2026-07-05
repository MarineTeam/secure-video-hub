import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_portal_info",
  title: "Get portal info",
  description: "Return basic information about this Marine Video Portal instance.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          name: "Marine Video Portal",
          description:
            "Private, invite-only video portal backed by bunny.net Stream with admin-managed viewers and share links.",
          features: [
            "Approved-viewer library with resumable playback",
            "Short-lived signed share links for external recipients",
            "Admin dashboard for videos, viewers, shares, settings, activity, analytics",
          ],
        }),
      },
    ],
  }),
});
