// Plugin framework server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ALL_PERMISSIONS, PLUGINS, PLUGIN_IDS } from "@/lib/plugins/registry";

export type PluginContext = {
  enabled: string[];
  permissions: string[];
  isAdmin: boolean;
};

/** Enabled plugin ids + the caller's effective permissions. */
export const getPluginContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PluginContext> => {
    const { supabase, userId } = context;
    const [{ data: isAdmin }, { data: states }, { data: roles }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.from("plugin_states").select("id, enabled"),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const overrides = new Map((states ?? []).map((s) => [s.id, s.enabled]));
    const enabled = PLUGINS.filter((p) => p.core || (overrides.get(p.id) ?? p.defaultEnabled)).map((p) => p.id);

    if (isAdmin) return { enabled, permissions: ALL_PERMISSIONS, isAdmin: true };

    const roleNames = (roles ?? []).map((r) => r.role);
    let permissions: string[] = [];
    if (roleNames.length) {
      const { data: rp } = await supabase.from("role_permissions").select("permission").in("role", roleNames);
      permissions = Array.from(new Set((rp ?? []).map((r) => r.permission)));
    }
    // Approved viewers always get read access to enabled member-facing content.
    const { data: isViewer } = await supabase.rpc("is_approved_viewer");
    if (isViewer) {
      permissions = Array.from(new Set([...permissions, ...ALL_PERMISSIONS.filter((p) => p.endsWith(".read"))]));
    }
    return { enabled, permissions, isAdmin: false };
  });

export const setPluginEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.enum(PLUGIN_IDS as [string, ...string[]]), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { assertAdmin, auditLog } = await import("@/lib/admin.server");
    await assertAdmin(supabase, userId);
    const def = PLUGINS.find((p) => p.id === data.id);
    if (def?.core) throw new Error("Core modules cannot be disabled.");

    const { error } = await supabase.from("plugin_states").upsert(
      { id: data.id, enabled: data.enabled, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    await auditLog(
      supabase,
      { id: userId, email: (claims as { email?: string }).email ?? null },
      data.enabled ? "plugin.enable" : "plugin.disable",
      data.id,
    );
    return { ok: true };
  });

export const updatePluginSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.enum(PLUGIN_IDS as [string, ...string[]]), settings: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("plugin_states").upsert(
      {
        id: data.id,
        settings: JSON.parse(data.settings) as never,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPluginStates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("plugin_states").select("id, enabled, settings");
    const overrides = new Map((data ?? []).map((s) => [s.id, s]));
    return PLUGINS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      group: p.group,
      core: !!p.core,
      permissions: p.permissions,
      tables: p.tables,
      enabled: p.core || (overrides.get(p.id)?.enabled ?? p.defaultEnabled),
      settings: JSON.stringify(overrides.get(p.id)?.settings ?? {}),
    }));
  });

export const listRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("role_permissions").select("role, permission");
    return (data ?? []) as { role: string; permission: string }[];
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        role: z.enum(["staff", "volunteer", "member"]),
        permission: z.enum(ALL_PERMISSIONS as [string, ...string[]]),
        granted: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(supabase, userId);
    if (data.granted) {
      const { error } = await supabase
        .from("role_permissions")
        .upsert({ role: data.role, permission: data.permission }, { onConflict: "role,permission" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", data.role)
        .eq("permission", data.permission);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
