// Server-only admin helpers: role check + audit log write.
import type { SupabaseClient } from "@supabase/supabase-js";

export class ForbiddenError extends Error {
  constructor(msg = "Forbidden") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

export async function assertAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(`role check failed: ${error.message}`);
  if (!data) throw new ForbiddenError("Admin only");
}

export async function assertApprovedViewer(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc("is_approved_viewer");
  if (error) throw new Error(`viewer check failed: ${error.message}`);
  if (!data) throw new ForbiddenError("Not approved");
}

export async function auditLog(
  supabase: SupabaseClient,
  actor: { id: string; email?: string | null },
  action: string,
  target?: string,
  meta: Record<string, unknown> = {},
) {
  await supabase.from("audit_log").insert({
    actor_id: actor.id,
    actor_email: actor.email ?? null,
    action,
    target: target ?? null,
    meta,
  });
}

// Simple sliding-window rate limiter. Uses service-role table.
export async function rateLimit(
  supabase: SupabaseClient,
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
    const { data, error } = await supabase
      .from("rate_limits")
      .upsert(
        { bucket, key, window_start: windowStart.toISOString(), count: 1 },
        { onConflict: "bucket,key,window_start", ignoreDuplicates: false },
      )
      .select();
    if (error) return true; // fail open
    // Read current
    const { data: row } = await supabase
      .from("rate_limits")
      .select("count")
      .eq("bucket", bucket)
      .eq("key", key)
      .eq("window_start", windowStart.toISOString())
      .single();
    return (row?.count ?? 1) <= limit;
  } catch {
    return true; // fail open
  }
}
