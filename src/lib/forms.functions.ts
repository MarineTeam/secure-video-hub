import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedViewer } from "@/lib/admin.server";
import { assertPluginEnabled, assertPermission } from "@/lib/plugins.server";

export const formFieldSchema = z.object({
  key: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(150),
  type: z.enum(["text", "textarea", "email", "number", "checkbox"]).default("text"),
  required: z.boolean().default(false),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const listForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPluginEnabled(context.supabase, "forms");
    await assertApprovedViewer(context.supabase);
    const { data, error } = await context.supabase
      .from("forms")
      .select("id, slug, title, description, schema, published")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((f) => ({ ...f, fields: (f.schema as unknown as FormField[]) ?? [] }));
  });

export const upsertForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
        title: z.string().trim().min(2).max(200),
        description: z.string().max(2000).nullable().optional(),
        fields: z.array(formFieldSchema).max(40),
        published: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "forms");
    await assertPermission(context.supabase, context.userId, "forms.manage");
    const row = {
      slug: data.slug,
      title: data.title,
      description: data.description ?? null,
      schema: data.fields as never,
      published: data.published,
      created_by: context.userId,
    };
    const { error } = data.id
      ? await context.supabase.from("forms").update(row).eq("id", data.id)
      : await context.supabase.from("forms").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "forms");
    await assertPermission(context.supabase, context.userId, "forms.manage");
    const { error } = await context.supabase.from("forms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        formId: z.string().uuid(),
        values: z.record(z.string().max(50), z.union([z.string().max(4000), z.number(), z.boolean()])),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "forms");
    await assertApprovedViewer(context.supabase);
    const { data: form, error: formErr } = await context.supabase
      .from("forms")
      .select("id, schema, published")
      .eq("id", data.formId)
      .maybeSingle();
    if (formErr) throw new Error(formErr.message);
    if (!form || !form.published) throw new Error("This form isn't accepting responses.");
    const fields = (form.schema as unknown as FormField[]) ?? [];
    for (const f of fields) {
      const v = data.values[f.key];
      if (f.required && (v === undefined || v === "" || v === false)) {
        throw new Error(`"${f.label}" is required.`);
      }
    }
    const clean: Record<string, unknown> = {};
    for (const f of fields) if (f.key in data.values) clean[f.key] = data.values[f.key];
    const { error } = await context.supabase
      .from("form_submissions")
      .insert({ form_id: data.formId, user_id: context.userId, data: clean as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFormSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ formId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPluginEnabled(context.supabase, "forms");
    await assertPermission(context.supabase, context.userId, "forms.manage");
    const { data: rows, error } = await context.supabase
      .from("form_submissions")
      .select("id, data, created_at")
      .eq("form_id", data.formId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
