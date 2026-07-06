
-- =========================================================
-- LIKES
-- =========================================================
CREATE TABLE public.video_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bunny_video_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bunny_video_id)
);
CREATE INDEX video_likes_video_idx ON public.video_likes(bunny_video_id);
GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT ALL ON public.video_likes TO service_role;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers read likes" ON public.video_likes FOR SELECT
  TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "viewers like own" ON public.video_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());
CREATE POLICY "viewers unlike own" ON public.video_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- COMMENTS
-- =========================================================
CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bunny_video_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.video_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX video_comments_video_idx ON public.video_comments(bunny_video_id, created_at);
CREATE INDEX video_comments_parent_idx ON public.video_comments(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers read comments" ON public.video_comments FOR SELECT
  TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "viewers add comments" ON public.video_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());
CREATE POLICY "authors edit own comments" ON public.video_comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "authors or admins delete comments" ON public.video_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER video_comments_touch
  BEFORE UPDATE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PLAYLISTS
-- =========================================================
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text,
  is_watch_later boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_watch_later_per_user ON public.playlists(user_id) WHERE is_watch_later;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner rw playlists" ON public.playlists FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());

CREATE TRIGGER playlists_touch
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.playlist_items (
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  bunny_video_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, bunny_video_id)
);
CREATE INDEX playlist_items_order ON public.playlist_items(playlist_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_items TO authenticated;
GRANT ALL ON public.playlist_items TO service_role;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner rw playlist items" ON public.playlist_items FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid())
    AND public.is_approved_viewer()
  );

-- =========================================================
-- SUBSCRIPTIONS TO COLLECTIONS
-- =========================================================
CREATE TABLE public.collection_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  notify boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, collection_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_subscriptions TO authenticated;
GRANT ALL ON public.collection_subscriptions TO service_role;
ALTER TABLE public.collection_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner rw subs" ON public.collection_subscriptions FOR ALL
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  bunny_video_id text,
  collection_id uuid,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own notifications" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner updates own notifications" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes own notifications" ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Fan-out trigger: when a new video appears in a collection, notify subscribers.
CREATE OR REPLACE FUNCTION public.notify_new_video()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.collection_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, bunny_video_id, collection_id, title, body)
  SELECT cs.user_id, 'new_video', NEW.bunny_video_id, NEW.collection_id,
         'New video: ' || NEW.title, NULL
  FROM public.collection_subscriptions cs
  WHERE cs.collection_id = NEW.collection_id AND cs.notify = true;
  RETURN NEW;
END $$;

CREATE TRIGGER video_metadata_notify_subs
  AFTER INSERT ON public.video_metadata
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_video();

-- Auto-create Watch Later playlist on first sign-in confirmation.
CREATE OR REPLACE FUNCTION public.ensure_watch_later()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.playlists (user_id, name, is_watch_later)
  VALUES (NEW.id, 'Watch Later', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
