import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

export const listGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPluginEnabled(context.supabase, "groups");
    await assertApprovedViewer(context.supabase);
    const [{ data: groups, error }, { data: members }] = await Promise.all([
      context.supabase
        .from("small_groups")
        .select("id, name, description, meeting_info, leader_id, is_open")
        .order("name"),
      context.supabase.from("group_members").select("group_id, user_id, role"),
    ]);
    if (error) throw new Error(error.message);
    return (groups ?? []).map((g) => {
      const rows = (members ?? []).filter((m) => m.group_id === g.id);
      return {
        ...g,
        memberCount: rows.length,
        isMember: rows.some((m) => m.user_id === context.userId),
        isLeader: g.leader_id === context.userId,
      };
    });
  });

export const upsertGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(150),
        description: z.string().max(2000).nullable().optional(),
        meetingInfo: z.string().max(500).nullable().optional(),
        isOpen: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "groups");
    if (!data.id) await assertPermission(context.supabase, context.userId, "groups.manage");
    const row = {
      name: data.name,
      description: data.description ?? null,
      meeting_info: data.meetingInfo ?? null,
      is_open: data.isOpen,
    };
    const { error } = data.id
      ? await context.supabase.from("small_groups").update(row).eq("id", data.id)
      : await context.supabase.from("small_groups").insert({ ...row, leader_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "groups");
    await assertPermission(context.supabase, context.userId, "groups.manage");
    const { error } = await context.supabase.from("small_groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleGroupMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ groupId: z.string().uuid(), join: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "groups");
    await assertApprovedViewer(context.supabase);
    const { error } = data.join
      ? await context.supabase.from("group_members").upsert({ group_id: data.groupId, user_id: context.userId })
      : await context.supabase
          .from("group_members")
          .delete()
          .eq("group_id", data.groupId)
          .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
