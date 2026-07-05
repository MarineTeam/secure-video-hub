import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getPortalInfoTool from "./tools/get-portal-info";
import listLibraryTool from "./tools/list-library";
import listCollectionsTool from "./tools/list-collections";
import continueWatchingTool from "./tools/continue-watching";
import listViewersTool from "./tools/list-viewers";
import addViewerTool from "./tools/add-viewer";
import removeViewerTool from "./tools/remove-viewer";
import listSharesTool from "./tools/list-shares";
import createShareTool from "./tools/create-share";
import revokeShareTool from "./tools/revoke-share";
import getAuditLogTool from "./tools/get-audit-log";

// OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy).
// Read the project ref from the Vite-inlined env; the fallback keeps the issuer
// well-formed during manifest extraction and is never trusted at runtime.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "marine-video-portal-mcp",
  title: "Marine Video Portal MCP",
  version: "0.2.0",
  instructions:
    "Tools for the Marine Video Portal. Viewer tools (list_library, list_collections, continue_watching) require an approved viewer. Admin tools (list_viewers, add_viewer, remove_viewer, list_shares, create_share, revoke_share, get_audit_log) require an admin. Use get_portal_info to describe the portal and echo to verify connectivity.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    getPortalInfoTool,
    listLibraryTool,
    listCollectionsTool,
    continueWatchingTool,
    listViewersTool,
    addViewerTool,
    removeViewerTool,
    listSharesTool,
    createShareTool,
    revokeShareTool,
    getAuditLogTool,
  ],
});
