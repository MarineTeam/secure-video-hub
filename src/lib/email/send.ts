// Client helper to POST a transactional email via the Lovable-scaffolded route.
// If the email infra isn't set up yet, callers should wrap this in try/catch.
import { supabase } from "@/integrations/supabase/client";

export interface SendEmailParams {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
  subject?: string;
}

export async function sendTransactionalEmail(params: SendEmailParams): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/lovable/email/transactional/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
}
