import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PluginGate } from "@/components/plugin-gate";
import { usePlugins } from "@/hooks/use-plugins";
import { listForms, upsertForm, deleteForm, submitForm, listFormSubmissions, type FormField } from "@/lib/forms.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({
    meta: [
      { title: "Forms — Marine Video Portal" },
      { name: "description", content: "Sign-up and contact forms for church activities." },
      { property: "og:title", content: "Forms — Marine Video Portal" },
      { property: "og:description", content: "Sign-up and contact forms for church activities." },
    ],
  }),
  component: () => (
    <PluginGate plugin="forms">
      <FormsPage />
    </PluginGate>
  ),
});

type FormRow = Awaited<ReturnType<typeof listForms>>[number];
type Value = string | number | boolean;

function FormsPage() {
  const qc = useQueryClient();
  const { can } = usePlugins();
  const manage = can("forms.manage");
  const forms = useQuery({ queryKey: ["forms"], queryFn: () => listForms(), retry: false });
  const remove = useMutation({
    mutationFn: (id: string) => deleteForm({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["forms"] }); toast.success("Form deleted."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Forms</h1>
          <p className="text-sm text-muted-foreground">Sign-ups and responses.</p>
        </div>
        {manage && <FormBuilder />}
      </div>

      {forms.isLoading && <p className="text-sm text-muted-foreground">Loading forms…</p>}
      {forms.isError && <p className="text-sm text-destructive">Couldn't load forms.</p>}
      {forms.data?.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">No forms yet.</div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(forms.data ?? []).map((f) => (
          <article key={f.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{f.title}</h2>
              {!f.published && <Badge variant="outline">Draft</Badge>}
            </div>
            {f.description && <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>}
            {f.published && <FormFill form={f} />}
            {manage && (
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                <FormBuilder form={f} />
                <Submissions form={f} />
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)} aria-label="Delete form">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  );
}

function FormFill({ form }: { form: FormRow }) {
  const [values, setValues] = useState<Record<string, Value>>({});
  const send = useMutation({
    mutationFn: () => submitForm({ data: { formId: form.id, values } }),
    onSuccess: () => { setValues({}); toast.success("Thanks — your response was sent."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mt-3 grid gap-2">
      {form.fields.map((f) => (
        <label key={f.key} className="text-xs text-muted-foreground">
          {f.label}{f.required ? " *" : ""}
          {f.type === "textarea" ? (
            <Textarea rows={3} maxLength={4000} value={String(values[f.key] ?? "")} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : f.type === "checkbox" ? (
            <div className="mt-1">
              <Checkbox checked={!!values[f.key]} onCheckedChange={(v) => setValues({ ...values, [f.key]: !!v })} />
            </div>
          ) : (
            <Input
              type={f.type === "email" ? "email" : f.type === "number" ? "number" : "text"}
              maxLength={500}
              value={String(values[f.key] ?? "")}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
      <Button size="sm" className="justify-self-start" disabled={send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? "Sending…" : "Submit"}
      </Button>
    </div>
  );
}

function Submissions({ form }: { form: FormRow }) {
  const [open, setOpen] = useState(false);
  const rows = useQuery({
    queryKey: ["form-submissions", form.id],
    queryFn: () => listFormSubmissions({ data: { formId: form.id } }),
    enabled: open,
    retry: false,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Responses</Button></DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.title} — responses</DialogTitle></DialogHeader>
        {rows.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows.data?.length === 0 && <p className="text-sm text-muted-foreground">No responses yet.</p>}
        <div className="space-y-2">
          {(rows.data ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              {Object.entries((r.data ?? {}) as Record<string, unknown>).map(([k, v]) => (
                <p key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</p>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormBuilder({ form }: { form?: FormRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState({
    slug: form?.slug ?? "",
    title: form?.title ?? "",
    description: form?.description ?? "",
    published: form?.published ?? false,
  });
  const [fields, setFields] = useState<FormField[]>(form?.fields ?? []);

  const save = useMutation({
    mutationFn: () =>
      upsertForm({
        data: {
          id: form?.id,
          slug: meta.slug.trim(),
          title: meta.title.trim(),
          description: meta.description || null,
          fields,
          published: meta.published,
        },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["forms"] }); setOpen(false); toast.success("Form saved."); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = (i: number, patch: Partial<FormField>) =>
    setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={form ? "outline" : "default"}>
          {form ? "Edit" : <><Plus className="mr-1.5 h-4 w-4" /> New form</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form ? "Edit form" : "New form"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Title" maxLength={200} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          <Input
            placeholder="Short name (lowercase-with-dashes)"
            maxLength={60}
            value={meta.slug}
            onChange={(e) => setMeta({ ...meta, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
          />
          <Textarea placeholder="Description" rows={2} maxLength={2000} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />

          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_130px_auto]">
                <Input placeholder="Label" value={f.label} onChange={(e) => update(i, { label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50) })} />
                <Input placeholder="Key" value={f.key} onChange={(e) => update(i, { key: e.target.value })} />
                <Select value={f.type} onValueChange={(v) => update(i, { type: v as FormField["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["text", "textarea", "email", "number", "checkbox"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Checkbox checked={f.required} onCheckedChange={(v) => update(i, { required: !!v })} /> Req
                  </label>
                  <Button size="icon" variant="ghost" aria-label="Remove field" onClick={() => setFields(fields.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFields([...fields, { key: `field_${fields.length + 1}`, label: "", type: "text", required: false }])}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add field
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={meta.published} onCheckedChange={(v) => setMeta({ ...meta, published: !!v })} /> Accept responses
          </label>
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || meta.title.trim().length < 2 || meta.slug.trim().length < 2} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
