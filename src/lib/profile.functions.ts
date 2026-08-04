// Viewer profile server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio")
      .eq("id", userId)
      .maybeSingle();
    return {
      id: userId,
      email: (claims as { email?: string }).email ?? null,
      display_name: data?.display_name ?? null,
      avatar_url: data?.avatar_url ?? null,
      bio: data?.bio ?? null,
    };
  });

const profileSchema = z.object({
  display_name: z.string().max(80).nullable().optional(),
  avatar_url: z.string().url().max(500).nullable().optional().or(z.literal("")),
  bio: z.string().max(500).nullable().optional(),
});

export const upsertMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertApprovedViewer } = await import("@/lib/admin.server");
    await assertApprovedViewer(supabase);
    const payload = {
      id: userId,
      display_name: data.display_name?.trim() || null,
      avatar_url: (data.avatar_url as string | null)?.trim() || null,
      bio: data.bio?.trim() || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
