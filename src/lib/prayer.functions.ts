import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

export const listPrayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPluginEnabled(context.supabase, "prayer");
    await assertApprovedViewer(context.supabase);
    const { data, error } = await context.supabase
      .from("prayer_requests")
      .select("id, user_id, title, body, is_anonymous, answered, created_at")
      .order("answered", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((p) => p.id);
    const [{ data: inters }, { data: profiles }] = await Promise.all([
      ids.length
        ? context.supabase.from("prayer_intercessions").select("prayer_id, user_id").in("prayer_id", ids)
        : Promise.resolve({ data: [] as { prayer_id: string; user_id: string }[] }),
      context.supabase.from("profiles").select("id, display_name"),
    ]);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    return (data ?? []).map((p) => {
      const rows = (inters ?? []).filter((i) => i.prayer_id === p.id);
      return {
        id: p.id,
        title: p.title,
        body: p.body,
        answered: p.answered,
        createdAt: p.created_at,
        author: p.is_anonymous ? "Anonymous" : (nameById.get(p.user_id) ?? "Member"),
        isMine: p.user_id === context.userId,
        prayerCount: rows.length,
        iPrayed: rows.some((r) => r.user_id === context.userId),
      };
    });
  });

export const createPrayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(150),
        body: z.string().trim().max(2000).default(""),
        isAnonymous: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "prayer");
    await assertApprovedViewer(context.supabase);
    const { error } = await context.supabase.from("prayer_requests").insert({
      user_id: context.userId,
      title: data.title,
      body: data.body,
      is_anonymous: data.isAnonymous,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePrayed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "prayer");
    await assertApprovedViewer(context.supabase);
    const { error } = data.on
      ? await context.supabase
          .from("prayer_intercessions")
          .upsert({ prayer_id: data.id, user_id: context.userId })
      : await context.supabase
          .from("prayer_intercessions")
          .delete()
          .eq("prayer_id", data.id)
          .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrayerAnswered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), answered: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "prayer");
    const { error } = await context.supabase
      .from("prayer_requests")
      .update({ answered: data.answered })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePrayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "prayer");
    const { error } = await context.supabase.from("prayer_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moderatePrayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "prayer");
    await assertPermission(context.supabase, context.userId, "prayer.manage");
    const { error } = await context.supabase.from("prayer_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
