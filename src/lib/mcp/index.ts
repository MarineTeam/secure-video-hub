import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getPortalInfoTool from "./tools/get-portal-info";

export default defineMcp({
  name: "marine-video-portal-mcp",
  title: "Marine Video Portal MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Marine Video Portal. Use `get_portal_info` to describe the portal and `echo` to verify connectivity. Video library, share, and admin operations are gated behind the portal's own authentication and are not exposed as MCP tools.",
  tools: [echoTool, getPortalInfoTool],
});
