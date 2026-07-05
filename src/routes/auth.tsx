import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Film } from "lucide-react";
import { z } from "zod";
import { syncAdminEmails } from "@/lib/library.functions";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const target = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
        window.location.href = target;
      }
    });
  }, [redirect]);

  async function afterSignedIn() {
    // Sync ADMIN_EMAILS in case this email should be admin
    try { await syncAdminEmails(); } catch { /* ignore */ }
    const target = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
    // Use full navigation so relative same-origin OAuth-consent paths run their loaders.
    window.location.href = target;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const returnQs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth${returnQs}` },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your email.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await afterSignedIn();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const returnQs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth" + returnQs,
    });
    if ("error" in result && result.error) {
      toast.error(String(result.error));
      setBusy(false);
      return;
    }
    if (!("redirected" in result && result.redirected)) {
      await afterSignedIn();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="rounded-md gradient-brand p-2">
            <Film className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Marine Video Portal</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "signin" && "Sign in to your account"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset your password"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "forgot" && (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <Button type="submit" className="w-full gradient-brand text-primary-foreground" disabled={busy}>
            {mode === "signin" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Send reset link"}
          </Button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
              Continue with Google
            </Button>
          </>
        )}

        <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              <button className="hover:text-foreground" onClick={() => setMode("forgot")} type="button">Forgot password?</button>
              <button className="hover:text-foreground" onClick={() => setMode("signup")} type="button">Create an account</button>
            </>
          ) : (
            <button className="hover:text-foreground" onClick={() => setMode("signin")} type="button">Back to sign in</button>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Access to videos requires an admin to add you to the approved list.
          <br />
          <Link to="/" className="hover:text-foreground">Home</Link>
        </p>
      </div>
    </div>
  );
}
