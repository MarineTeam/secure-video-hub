import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

const hymnInput = z.object({
  id: z.string().uuid().optional(),
  number: z.number().int().min(1).max(9999).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  titleEs: z.string().trim().max(200).nullable().optional(),
  author: z.string().trim().max(200).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  lyrics: z.string().max(20000).default(""),
  lyricsEs: z.string().max(20000).nullable().optional(),
  audioUrl: z.string().trim().url().max(500).nullable().optional(),
  bunnyVideoId: z.string().trim().max(100).nullable().optional(),
});

export const listHymns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(100).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "hymnal");
    await assertApprovedViewer(context.supabase);
    let query = context.supabase
      .from("hymns")
      .select("id, number, title, title_es, author, category, lyrics, lyrics_es, audio_url, bunny_video_id")
      .order("number", { ascending: true, nullsFirst: false })
      .order("title")
      .limit(500);
    const q = data.q?.trim();
    if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,category.ilike.%${q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertHymn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => hymnInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "hymnal");
    await assertPermission(context.supabase, context.userId, "hymnal.manage");
    const row = {
      number: data.number ?? null,
      title: data.title,
      title_es: data.titleEs ?? null,
      author: data.author ?? null,
      category: data.category ?? null,
      lyrics: data.lyrics,
      lyrics_es: data.lyricsEs ?? null,
      audio_url: data.audioUrl ?? null,
      bunny_video_id: data.bunnyVideoId ?? null,
      created_by: context.userId,
    };
    const { error } = data.id
      ? await context.supabase.from("hymns").update(row).eq("id", data.id)
      : await context.supabase.from("hymns").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHymn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "hymnal");
    await assertPermission(context.supabase, context.userId, "hymnal.manage");
    const { error } = await context.supabase.from("hymns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
