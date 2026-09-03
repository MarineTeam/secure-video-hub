-- Plugin enable/disable state + per-plugin settings (defaults live in app code)
CREATE TABLE IF NOT EXISTS public.plugin_states (
  id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.plugin_states TO authenticated;
GRANT ALL ON public.plugin_states TO service_role;
ALTER TABLE public.plugin_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read plugin states"
  ON public.plugin_states FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage plugin states"
  ON public.plugin_states FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Role -> permission grants
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.plugin_enabled(_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT ps.enabled FROM public.plugin_states ps WHERE ps.id = _id), true)
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
     OR EXISTS (
       SELECT 1
       FROM public.user_roles ur
       JOIN public.role_permissions rp ON rp.role = ur.role
       WHERE ur.user_id = _user_id AND rp.permission = _permission
     )
$$;