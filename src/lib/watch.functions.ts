// Watch-page server functions: signed embed URL + progress save.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getSignedEmbed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { assertApprovedViewer, rateLimit } = await import("@/lib/admin.server");
    const { bunnySignedEmbedUrl } = await import("@/lib/bunny.server");
    await assertApprovedViewer(supabase);
    const ok = await rateLimit(
      (await import("@/integrations/supabase/client.server")).supabaseAdmin,
      "embed",
      context.userId,
      60,
      60,
    );
    if (!ok) throw new Error("Rate limit exceeded");
    // Ensure this video exists in our metadata (i.e. library-linked)
    const { data: v } = await supabase
      .from("video_metadata")
      .select("bunny_video_id, title")
      .eq("bunny_video_id", data.videoId)
      .maybeSingle();
    if (!v) throw new Error("Video not found");
    return { url: bunnySignedEmbedUrl(data.videoId), title: v.title };
  });

export const saveProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        videoId: z.string().min(4).max(200),
        position: z.number().min(0).max(100000),
        duration: z.number().min(0).max(100000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("watch_progress")
      .upsert(
        {
          user_id: userId,
          bunny_video_id: data.videoId,
          position_seconds: data.position,
          duration_seconds: data.duration,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,bunny_video_id" },
      );
    return { ok: true };
  });

export const getMyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("watch_progress")
      .select("position_seconds, duration_seconds")
      .eq("user_id", context.userId)
      .eq("bunny_video_id", data.videoId)
      .maybeSingle();
    return row ?? null;
  });
