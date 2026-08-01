CREATE TABLE public.video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bunny_video_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX video_views_video_idx ON public.video_views (bunny_video_id, created_at DESC);
CREATE INDEX video_views_user_idx ON public.video_views (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;

ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers record own views" ON public.video_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved_viewer());

CREATE POLICY "own or admin reads views" ON public.video_views
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.top_videos(_days integer DEFAULT 30, _limit integer DEFAULT 12)
RETURNS TABLE (bunny_video_id text, views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.bunny_video_id, count(*)::bigint AS views
  FROM public.video_views v
  WHERE public.is_approved_viewer()
    AND v.created_at > now() - (greatest(_days, 1) || ' days')::interval
  GROUP BY v.bunny_video_id
  ORDER BY views DESC
  LIMIT least(greatest(_limit, 1), 50)
$$;

CREATE OR REPLACE FUNCTION public.video_view_counts(_ids text[])
RETURNS TABLE (bunny_video_id text, views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.bunny_video_id, count(*)::bigint
  FROM public.video_views v
  WHERE public.is_approved_viewer() AND v.bunny_video_id = ANY(_ids)
  GROUP BY v.bunny_video_id
$$;