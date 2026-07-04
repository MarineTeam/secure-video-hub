
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Roles
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Approved viewers
-- ============================================================
CREATE TABLE public.approved_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_viewers TO authenticated;
GRANT ALL ON public.approved_viewers TO service_role;
ALTER TABLE public.approved_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage approved_viewers"
  ON public.approved_viewers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper: is the current user approved (or admin)?
CREATE OR REPLACE FUNCTION public.is_approved_viewer()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.approved_viewers av
      JOIN auth.users u ON lower(u.email) = lower(av.email::text)
      WHERE u.id = auth.uid()
    )
$$;

-- ============================================================
-- Collections
-- ============================================================
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved viewers can read collections"
  ON public.collections FOR SELECT
  TO authenticated
  USING (public.is_approved_viewer());

CREATE POLICY "Admins manage collections"
  ON public.collections FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Video metadata (mirror of bunny.net library)
-- ============================================================
CREATE TABLE public.video_metadata (
  bunny_video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  sort_order BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_metadata TO authenticated;
GRANT ALL ON public.video_metadata TO service_role;
ALTER TABLE public.video_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved viewers can read video_metadata"
  ON public.video_metadata FOR SELECT
  TO authenticated
  USING (public.is_approved_viewer());

CREATE POLICY "Admins manage video_metadata"
  ON public.video_metadata FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_video_metadata_collection ON public.video_metadata(collection_id);
CREATE INDEX idx_video_metadata_sort ON public.video_metadata(sort_order DESC);

-- ============================================================
-- Share links
-- ============================================================
CREATE TABLE public.share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  bunny_video_id TEXT NOT NULL,
  recipient_email CITEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage share_links"
  ON public.share_links FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_share_links_token ON public.share_links(token);
CREATE INDEX idx_share_links_recipient ON public.share_links(recipient_email);

-- Validation trigger (replaces CHECK for time-dependent rule)
CREATE OR REPLACE FUNCTION public.validate_share_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_share_link_insert
  BEFORE INSERT ON public.share_links
  FOR EACH ROW EXECUTE FUNCTION public.validate_share_link();

-- ============================================================
-- Watch progress
-- ============================================================
CREATE TABLE public.watch_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bunny_video_id TEXT NOT NULL,
  position_seconds NUMERIC NOT NULL DEFAULT 0,
  duration_seconds NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bunny_video_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_progress TO authenticated;
GRANT ALL ON public.watch_progress TO service_role;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watch progress"
  ON public.watch_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_watch_progress_updated ON public.watch_progress(user_id, updated_at DESC);

-- ============================================================
-- Settings (key/value)
-- ============================================================
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved viewers can read settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (public.is_approved_viewer());

CREATE POLICY "Admins manage settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed defaults
INSERT INTO public.settings(key, value) VALUES
  ('homepage_video_count', '24'::jsonb),
  ('palette', '"ocean"'::jsonb),
  ('idle_timeout_minutes', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Audit log
-- ============================================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email CITEXT,
  action TEXT NOT NULL,
  target TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit_log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

-- Cap trigger: keep last 1000 rows
CREATE OR REPLACE FUNCTION public.cap_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_log
  WHERE id IN (
    SELECT id FROM public.audit_log
    ORDER BY created_at DESC
    OFFSET 1000
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER cap_audit_log_trigger
  AFTER INSERT ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.cap_audit_log();

-- ============================================================
-- Rate limiter (sliding window buckets)
-- ============================================================
CREATE TABLE public.rate_limits (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window_start)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No user policies: service_role only

-- ============================================================
-- Bootstrap: promote users whose verified email is in
-- the ADMIN_EMAILS setting (populated from env at first run)
-- ============================================================

-- We store admin emails in settings so the DB trigger can read them
-- without server-side env. The server keeps this in sync from the
-- ADMIN_EMAILS secret on startup.
INSERT INTO public.settings(key, value)
VALUES ('admin_emails', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_admin_for_bootstrap_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_list JSONB;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT value INTO admin_list FROM public.settings WHERE key = 'admin_emails';
  IF admin_list IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(admin_list) AS e(email)
    WHERE lower(e.email) = lower(NEW.email)
  ) THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Also add to approved viewers
    INSERT INTO public.approved_viewers(email, added_by)
    VALUES (NEW.email, NEW.id)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_bootstrap_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_bootstrap_email();

CREATE TRIGGER on_auth_user_confirmed_bootstrap_admin
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_admin_for_bootstrap_email();

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER video_metadata_updated_at
  BEFORE UPDATE ON public.video_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
