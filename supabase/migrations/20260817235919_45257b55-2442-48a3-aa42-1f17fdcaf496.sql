ALTER TABLE public.share_links
  ALTER COLUMN recipient_email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_salt text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_views integer;

ALTER TABLE public.share_links
  ADD CONSTRAINT share_links_access_mode_check CHECK (access_mode IN ('email','public'));

ALTER TABLE public.share_links
  ADD CONSTRAINT share_links_email_required CHECK (access_mode <> 'email' OR recipient_email IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.share_privileges (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_share boolean NOT NULL DEFAULT true,
  can_share_public boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_privileges TO authenticated;
GRANT ALL ON public.share_privileges TO service_role;
ALTER TABLE public.share_privileges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage share privileges" ON public.share_privileges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own share privileges" ON public.share_privileges
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.can_share(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
     OR COALESCE((SELECT sp.can_share FROM public.share_privileges sp WHERE sp.user_id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.can_share_public(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
     OR COALESCE((SELECT sp.can_share_public FROM public.share_privileges sp WHERE sp.user_id = _user_id), false)
$$;

CREATE POLICY "Creators read own share links" ON public.share_links
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Creators revoke own share links" ON public.share_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Permitted members create share links" ON public.share_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.can_share(auth.uid()));