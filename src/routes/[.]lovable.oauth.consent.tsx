import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Beta @supabase/supabase-js `auth.oauth` namespace — typed locally.
type OAuthClient = { name?: string; client_id?: string; redirect_uris?: string[] };
type AuthorizationDetails = {
  client?: OAuthClient;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  approveAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  denyAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
};
const authOAuth = (): OAuthApi =>
  (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

function isSameOriginPath(p: string): boolean {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId =
      new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await authOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return data;
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-lg font-semibold">Authorization error</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {(error as Error)?.message ?? String(error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = authOAuth();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an external app";
  const scopes = details?.scopes ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="glass w-full space-y-5 rounded-2xl p-8">
        <div>
          <h1 className="text-lg font-semibold">Connect {clientName} to Marine Video Portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This lets {clientName} use this portal as you. Your portal permissions
            (approved viewer, admin) still apply — this does not bypass them.
          </p>
        </div>

        {scopes.length > 0 && (
          <div className="space-y-1 text-sm">
            <div className="text-xs uppercase text-muted-foreground">Requested access</div>
            <ul className="list-inside list-disc">
              {scopes.map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            className="flex-1 rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(true)}
          >
            Approve
          </button>
          <button
            className="flex-1 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}

// Prevent unused-import warning from stripping isSameOriginPath in future edits.
void isSameOriginPath;
