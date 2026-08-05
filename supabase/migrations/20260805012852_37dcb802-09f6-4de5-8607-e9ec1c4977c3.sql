CREATE TABLE IF NOT EXISTS public.video_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bunny_video_id text NOT NULL,
  label text NOT NULL,
  start_seconds numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (bunny_video_id, start_seconds)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_chapters TO authenticated;
GRANT ALL ON public.video_chapters TO service_role;

ALTER TABLE public.video_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers read chapters" ON public.video_chapters
  FOR SELECT TO authenticated USING (public.is_approved_viewer());
CREATE POLICY "admins manage chapters" ON public.video_chapters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER video_chapters_touch BEFORE UPDATE ON public.video_chapters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX video_chapters_video_idx ON public.video_chapters (bunny_video_id, start_seconds);

ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

CREATE OR REPLACE FUNCTION public.public_playlist(_token text)
RETURNS TABLE(playlist_id uuid, playlist_name text, playlist_description text, bunny_video_id text, title text, item_position integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.description, pi.bunny_video_id, vm.title, pi.position
  FROM public.playlists p
  JOIN public.playlist_items pi ON pi.playlist_id = p.id
  JOIN public.video_metadata vm ON vm.bunny_video_id = pi.bunny_video_id
  WHERE p.share_token = _token AND p.is_public = true
  ORDER BY pi.position ASC, pi.added_at ASC
$$;

GRANT EXECUTE ON FUNCTION public.public_playlist(text) TO anon, authenticated;