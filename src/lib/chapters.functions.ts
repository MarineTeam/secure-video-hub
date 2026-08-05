// Video chapters: viewers read, admins manage.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const vid = z.string().min(1).max(200);

export const listChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: vid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(context.supabase);
    const { data: rows } = await context.supabase
      .from("video_chapters")
      .select("id, label, start_seconds")
      .eq("bunny_video_id", data.videoId)
      .order("start_seconds", { ascending: true });
    return (rows ?? []).map((r) => ({ id: r.id, label: r.label, start: Number(r.start_seconds) }));
  });

const saveSchema = z.object({
  videoId: vid,
  chapters: z
    .array(z.object({ label: z.string().min(1).max(120), start: z.number().min(0).max(360000) }))
    .max(200),
});

export const saveChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, auditLog } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    await context.supabase.from("video_chapters").delete().eq("bunny_video_id", data.videoId);
    if (data.chapters.length) {
      const { error } = await context.supabase.from("video_chapters").insert(
        data.chapters.map((c) => ({
          bunny_video_id: data.videoId,
          label: c.label.trim(),
          start_seconds: c.start,
        })),
      );
      if (error) throw new Error(error.message);
    }
    await auditLog(
      context.supabase,
      { id: context.userId, email: (context.claims as { email?: string }).email ?? null },
      "chapters.save",
      data.videoId,
      { count: data.chapters.length },
    );
    return { ok: true, count: data.chapters.length };
  });
