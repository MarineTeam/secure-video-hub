-- Hymnal
CREATE TABLE public.hymns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer,
  title text NOT NULL,
  title_es text,
  author text,
  category text,
  lyrics text NOT NULL DEFAULT '',
  lyrics_es text,
  audio_url text,
  bunny_video_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hymns TO authenticated;
GRANT ALL ON public.hymns TO service_role;
ALTER TABLE public.hymns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read hymns" ON public.hymns FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "manage hymns" ON public.hymns FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'hymnal.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'hymnal.manage'));
CREATE TRIGGER hymns_touch BEFORE UPDATE ON public.hymns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX hymns_title_idx ON public.hymns (lower(title));

-- Service planning
CREATE TABLE public.service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  service_date timestamptz NOT NULL,
  notes text,
  published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_plans TO authenticated;
GRANT ALL ON public.service_plans TO service_role;
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read service plans" ON public.service_plans FOR SELECT TO authenticated
  USING (public.is_approved_viewer() AND (published OR public.has_permission(auth.uid(), 'services.manage')));
CREATE POLICY "manage service plans" ON public.service_plans FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'services.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'services.manage'));
CREATE TRIGGER service_plans_touch BEFORE UPDATE ON public.service_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.service_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'item',
  title text NOT NULL,
  detail text,
  duration_minutes integer,
  hymn_id uuid REFERENCES public.hymns(id) ON DELETE SET NULL,
  bunny_video_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_items TO authenticated;
GRANT ALL ON public.service_items TO service_role;
ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read service items" ON public.service_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_plans p WHERE p.id = plan_id
    AND public.is_approved_viewer() AND (p.published OR public.has_permission(auth.uid(), 'services.manage'))));
CREATE POLICY "manage service items" ON public.service_items FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'services.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'services.manage'));

-- Rotas
CREATE TABLE public.rota_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_roles TO authenticated;
GRANT ALL ON public.rota_roles TO service_role;
ALTER TABLE public.rota_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read rota roles" ON public.rota_roles FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "manage rota roles" ON public.rota_roles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'rotas.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'rotas.manage'));

CREATE TABLE public.rota_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.rota_roles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.service_plans(id) ON DELETE CASCADE,
  serve_date timestamptz NOT NULL,
  user_id uuid,
  person_name text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_assignments TO authenticated;
GRANT ALL ON public.rota_assignments TO service_role;
ALTER TABLE public.rota_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read rota assignments" ON public.rota_assignments FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "assignee updates own rota" ON public.rota_assignments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "manage rota assignments" ON public.rota_assignments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'rotas.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'rotas.manage'));
CREATE TRIGGER rota_assignments_touch BEFORE UPDATE ON public.rota_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  published boolean NOT NULL DEFAULT true,
  rsvp_enabled boolean NOT NULL DEFAULT true,
  capacity integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read events" ON public.events FOR SELECT TO authenticated
  USING (public.is_approved_viewer() AND (published OR public.has_permission(auth.uid(), 'events.manage')));
CREATE POLICY "manage events" ON public.events FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'events.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'events.manage'));
CREATE TRIGGER events_touch BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_rsvps (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'going',
  guests integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rsvps" ON public.event_rsvps FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'events.manage'));
CREATE POLICY "own rsvp write" ON public.event_rsvps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());

-- Forms
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read forms" ON public.forms FOR SELECT TO authenticated
  USING (public.is_approved_viewer() AND (published OR public.has_permission(auth.uid(), 'forms.manage')));
CREATE POLICY "manage forms" ON public.forms FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'forms.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'forms.manage'));
CREATE TRIGGER forms_touch BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  user_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or manage submissions" ON public.form_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'forms.manage'));
CREATE POLICY "submit forms" ON public.form_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());

-- Prayer wall
CREATE TABLE public.prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_anonymous boolean NOT NULL DEFAULT false,
  answered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_requests TO authenticated;
GRANT ALL ON public.prayer_requests TO service_role;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read prayers" ON public.prayer_requests FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "create own prayer" ON public.prayer_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());
CREATE POLICY "update own prayer" ON public.prayer_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'prayer.manage'))
  WITH CHECK (auth.uid() = user_id OR public.has_permission(auth.uid(), 'prayer.manage'));
CREATE POLICY "delete own prayer" ON public.prayer_requests FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'prayer.manage'));
CREATE TRIGGER prayer_requests_touch BEFORE UPDATE ON public.prayer_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prayer_intercessions (
  prayer_id uuid NOT NULL REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.prayer_intercessions TO authenticated;
GRANT ALL ON public.prayer_intercessions TO service_role;
ALTER TABLE public.prayer_intercessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read intercessions" ON public.prayer_intercessions FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "own intercession insert" ON public.prayer_intercessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());
CREATE POLICY "own intercession delete" ON public.prayer_intercessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Small groups
CREATE TABLE public.small_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  meeting_info text,
  leader_id uuid,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.small_groups TO authenticated;
GRANT ALL ON public.small_groups TO service_role;
ALTER TABLE public.small_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read groups" ON public.small_groups FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "manage groups" ON public.small_groups FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'groups.manage') OR auth.uid() = leader_id)
  WITH CHECK (public.has_permission(auth.uid(), 'groups.manage') OR auth.uid() = leader_id);
CREATE TRIGGER small_groups_touch BEFORE UPDATE ON public.small_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.small_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read group members" ON public.group_members FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "join groups" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());
CREATE POLICY "leave or manage groups" ON public.group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'groups.manage'));

-- Announcements (also used by TV display)
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  body_es text,
  image_url text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  pinned boolean NOT NULL DEFAULT false,
  show_on_tv boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read announcements" ON public.announcements FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'announcements.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'announcements.manage'));
CREATE TRIGGER announcements_touch BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();