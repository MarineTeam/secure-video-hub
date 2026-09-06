import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPluginEnabled(context.supabase, "events");
    await assertApprovedViewer(context.supabase);
    const { data, error } = await context.supabase
      .from("events")
      .select("id, title, description, location, starts_at, ends_at, published, rsvp_enabled, capacity")
      .order("starts_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((e) => e.id);
    const { data: rsvps } = ids.length
      ? await context.supabase.from("event_rsvps").select("event_id, user_id, status, guests").in("event_id", ids)
      : { data: [] as { event_id: string; user_id: string; status: string; guests: number }[] };
    return (data ?? []).map((e) => {
      const mine = (rsvps ?? []).find((r) => r.event_id === e.id && r.user_id === context.userId);
      const going = (rsvps ?? []).filter((r) => r.event_id === e.id && r.status === "going");
      return {
        ...e,
        myStatus: mine?.status ?? null,
        goingCount: going.reduce((n, r) => n + 1 + (r.guests ?? 0), 0),
      };
    });
  });

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(200),
        description: z.string().max(4000).nullable().optional(),
        location: z.string().max(300).nullable().optional(),
        startsAt: z.string().min(4),
        endsAt: z.string().min(4).nullable().optional(),
        published: z.boolean().default(true),
        rsvpEnabled: z.boolean().default(true),
        capacity: z.number().int().min(1).max(100000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "events");
    await assertPermission(context.supabase, context.userId, "events.manage");
    const row = {
      title: data.title,
      description: data.description ?? null,
      location: data.location ?? null,
      starts_at: new Date(data.startsAt).toISOString(),
      ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : null,
      published: data.published,
      rsvp_enabled: data.rsvpEnabled,
      capacity: data.capacity ?? null,
      created_by: context.userId,
    };
    const { error } = data.id
      ? await context.supabase.from("events").update(row).eq("id", data.id)
      : await context.supabase.from("events").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "events");
    await assertPermission(context.supabase, context.userId, "events.manage");
    const { error } = await context.supabase.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rsvpEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        status: z.enum(["going", "maybe", "no"]),
        guests: z.number().int().min(0).max(20).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "events");
    await assertApprovedViewer(context.supabase);
    const { error } = await context.supabase.from("event_rsvps").upsert({
      event_id: data.eventId,
      user_id: context.userId,
      status: data.status,
      guests: data.guests,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
