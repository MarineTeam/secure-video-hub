import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

export const listAnnouncements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tvOnly: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, data.tvOnly ? "tv" : "announcements");
    await assertApprovedViewer(context.supabase);
    let q = context.supabase
      .from("announcements")
      .select("id, title, body, body_es, image_url, starts_at, ends_at, pinned, show_on_tv")
      .order("pinned", { ascending: false })
      .order("starts_at", { ascending: false })
      .limit(100);
    if (data.tvOnly) q = q.eq("show_on_tv", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const now = Date.now();
    return (rows ?? []).filter(
      (r) => new Date(r.starts_at).getTime() <= now && (!r.ends_at || new Date(r.ends_at).getTime() >= now),
    );
  });

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(200),
        body: z.string().max(4000).default(""),
        bodyEs: z.string().max(4000).nullable().optional(),
        imageUrl: z.string().trim().url().max(500).nullable().optional(),
        startsAt: z.string().min(4),
        endsAt: z.string().min(4).nullable().optional(),
        pinned: z.boolean().default(false),
        showOnTv: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "announcements");
    await assertPermission(context.supabase, context.userId, "announcements.manage");
    const row = {
      title: data.title,
      body: data.body,
      body_es: data.bodyEs ?? null,
      image_url: data.imageUrl ?? null,
      starts_at: new Date(data.startsAt).toISOString(),
      ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : null,
      pinned: data.pinned,
      show_on_tv: data.showOnTv,
      created_by: context.userId,
    };
    const { error } = data.id
      ? await context.supabase.from("announcements").update(row).eq("id", data.id)
      : await context.supabase.from("announcements").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "announcements");
    await assertPermission(context.supabase, context.userId, "announcements.manage");
    const { error } = await context.supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
