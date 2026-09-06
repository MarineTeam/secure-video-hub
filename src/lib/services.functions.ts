import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

export const listServicePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPluginEnabled(context.supabase, "services");
    await assertApprovedViewer(context.supabase);
    const { data, error } = await context.supabase
      .from("service_plans")
      .select("id, title, service_date, notes, published")
      .order("service_date", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getServicePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "services");
    await assertApprovedViewer(context.supabase);
    const { data: plan, error } = await context.supabase
      .from("service_plans")
      .select("id, title, service_date, notes, published")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) return null;
    const { data: items } = await context.supabase
      .from("service_items")
      .select("id, position, kind, title, detail, duration_minutes, hymn_id, bunny_video_id")
      .eq("plan_id", data.id)
      .order("position");
    return { plan, items: items ?? [] };
  });

export const upsertServicePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(200),
        serviceDate: z.string().min(4),
        notes: z.string().max(4000).nullable().optional(),
        published: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "services");
    await assertPermission(context.supabase, context.userId, "services.manage");
    const row = {
      title: data.title,
      service_date: new Date(data.serviceDate).toISOString(),
      notes: data.notes ?? null,
      published: data.published,
      created_by: context.userId,
    };
    const { data: saved, error } = data.id
      ? await context.supabase.from("service_plans").update(row).eq("id", data.id).select("id").single()
      : await context.supabase.from("service_plans").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: saved.id };
  });

export const deleteServicePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "services");
    await assertPermission(context.supabase, context.userId, "services.manage");
    const { error } = await context.supabase.from("service_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addServiceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        kind: z.enum(["song", "hymn", "reading", "sermon", "prayer", "video", "item"]).default("item"),
        title: z.string().trim().min(1).max(200),
        detail: z.string().max(2000).nullable().optional(),
        durationMinutes: z.number().int().min(0).max(600).nullable().optional(),
        hymnId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "services");
    await assertPermission(context.supabase, context.userId, "services.manage");
    const { count } = await context.supabase
      .from("service_items")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", data.planId);
    const { error } = await context.supabase.from("service_items").insert({
      plan_id: data.planId,
      position: count ?? 0,
      kind: data.kind,
      title: data.title,
      detail: data.detail ?? null,
      duration_minutes: data.durationMinutes ?? null,
      hymn_id: data.hymnId ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeServiceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "services");
    await assertPermission(context.supabase, context.userId, "services.manage");
    const { error } = await context.supabase.from("service_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveServiceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "services");
    await assertPermission(context.supabase, context.userId, "services.manage");
    for (let i = 0; i < data.orderedIds.length; i++) {
      const id = data.orderedIds[i]!;
      const { error } = await context.supabase
        .from("service_items")
        .update({ position: i })
        .eq("id", id)
        .eq("plan_id", data.planId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
