import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { getPaletteSetting } from "@/lib/library.functions";
import { paletteFromValue, applyPalette } from "@/lib/theme";
import { useQuery } from "@tanstack/react-query";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["palette"],
    queryFn: () => getPaletteSetting(),
    staleTime: 60_000,
  });
  useEffect(() => {
    if (data?.palette) applyPalette(paletteFromValue(data.palette));
  }, [data?.palette]);
  return <>{children}</>;
}

export function IdleTimeout({ minutes = 30 }: { minutes?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.auth.signOut();
        router.navigate({ to: "/auth" });
      }, minutes * 60 * 1000);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes, router]);
  return null;
}
