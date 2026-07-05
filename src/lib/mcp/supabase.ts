import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], isError: true as const };
}

export async function requireAdmin(ctx: ToolContext): Promise<SupabaseClient> {
  if (!ctx.isAuthenticated()) throw new Error("Not authenticated");
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase.rpc("has_role", { _user_id: ctx.getUserId(), _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
  return supabase;
}

export async function requireViewer(ctx: ToolContext): Promise<SupabaseClient> {
  if (!ctx.isAuthenticated()) throw new Error("Not authenticated");
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase.rpc("is_approved_viewer");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not an approved viewer");
  return supabase;
}

export async function auditLog(
  supabase: SupabaseClient,
  ctx: ToolContext,
  action: string,
  target?: string,
  meta: Record<string, unknown> = {},
) {
  await supabase.from("audit_log").insert({
    actor_id: ctx.getUserId(),
    actor_email: ctx.getUserEmail() ?? null,
    action,
    target: target ?? null,
    meta: { ...meta, via: "mcp" },
  });
}
