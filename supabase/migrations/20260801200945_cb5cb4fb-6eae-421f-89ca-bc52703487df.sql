REVOKE ALL ON FUNCTION public.top_videos(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.video_view_counts(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.top_videos(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.video_view_counts(text[]) TO authenticated, service_role;