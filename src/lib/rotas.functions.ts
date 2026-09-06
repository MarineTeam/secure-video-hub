import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

export const listRotas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPluginEnabled(context.supabase, "rotas");
    await assertApprovedViewer(context.supabase);
    const [{ data: roles, error: rolesErr }, { data: assignments, error: aErr }, { data: profiles }] =
      await Promise.all([
        context.supabase.from("rota_roles").select("id, name, description").order("name"),
        context.supabase
          .from("rota_assignments")
          .select("id, role_id, serve_date, user_id, person_name, status, notes")
          .order("serve_date", { ascending: true })
          .limit(500),
        context.supabase.from("profiles").select("id, display_name"),
      ]);
    if (rolesErr) throw new Error(rolesErr.message);
    if (aErr) throw new Error(aErr.message);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    return {
      roles: roles ?? [],
      assignments: (assignments ?? []).map((a) => ({
        ...a,
        who: a.person_name ?? (a.user_id ? (nameById.get(a.user_id) ?? "Member") : "Unassigned"),
        isMine: a.user_id === context.userId,
      })),
    };
  });

export const upsertRotaRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(100),
        description: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "rotas");
    await assertPermission(context.supabase, context.userId, "rotas.manage");
    const row = { name: data.name, description: data.description ?? null };
    const { error } = data.id
      ? await context.supabase.from("rota_roles").update(row).eq("id", data.id)
      : await context.supabase.from("rota_roles").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRotaRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "rotas");
    await assertPermission(context.supabase, context.userId, "rotas.manage");
    const { error } = await context.supabase.from("rota_roles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        roleId: z.string().uuid(),
        serveDate: z.string().min(4),
        personName: z.string().trim().max(150).nullable().optional(),
        userId: z.string().uuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "rotas");
    await assertPermission(context.supabase, context.userId, "rotas.manage");
    const row = {
      role_id: data.roleId,
      serve_date: new Date(data.serveDate).toISOString(),
      person_name: data.personName ?? null,
      user_id: data.userId ?? null,
      notes: data.notes ?? null,
    };
    const { error } = data.id
      ? await context.supabase.from("rota_assignments").update(row).eq("id", data.id)
      : await context.supabase.from("rota_assignments").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "rotas");
    await assertPermission(context.supabase, context.userId, "rotas.manage");
    const { error } = await context.supabase.from("rota_assignments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondToAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["accepted", "declined", "pending"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "rotas");
    await assertApprovedViewer(context.supabase);
    const { error } = await context.supabase
      .from("rota_assignments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
