// Server-only plugin/permission guards. Never trust the browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError } from "@/lib/admin.server";
import { getPlugin } from "@/lib/plugins/registry";

export class PluginDisabledError extends Error {
  constructor(id: string) {
    super(`The "${id}" module is disabled.`);
    this.name = "PluginDisabledError";
  }
}

export async function assertPluginEnabled(supabase: SupabaseClient, id: string): Promise<void> {
  const def = getPlugin(id);
  if (def?.core) return;
  const { data, error } = await supabase.rpc("plugin_enabled", { _id: id });
  if (error) throw new Error(`plugin check failed: ${error.message}`);
  if (!data) throw new PluginDisabledError(id);
}

export async function assertPermission(
  supabase: SupabaseClient,
  userId: string,
  permission: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (error) throw new Error(`permission check failed: ${error.message}`);
  if (!data) throw new ForbiddenError(`Missing permission: ${permission}`);
}

/** Common guard: plugin must be on AND caller must hold the permission. */
export async function guard(
  supabase: SupabaseClient,
  userId: string,
  pluginId: string,
  permission: string,
): Promise<void> {
  await assertPluginEnabled(supabase, pluginId);
  await assertPermission(supabase, userId, permission);
}
