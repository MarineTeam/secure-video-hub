
-- Move extensions out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION citext SET SCHEMA extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- Lock down security-definer helpers
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_approved_viewer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_viewer() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_admin_for_bootstrap_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cap_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_share_link() FROM PUBLIC, anon, authenticated;

-- Add explicit deny policy so rate_limits shows an intentional policy
CREATE POLICY "No user access to rate_limits"
  ON public.rate_limits FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
