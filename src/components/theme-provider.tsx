import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { getPaletteSetting } from "@/lib/library.functions";
import { paletteFromValue, applyPalette } from "@/lib/theme";
import { applyThemeMode, readDeviceSettings } from "@/lib/device-settings";
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

  // Per-device theme mode (system / light / dark).
  useEffect(() => {
    const apply = () => applyThemeMode(readDeviceSettings().themeMode);
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    window.addEventListener("mvp:device-settings", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("mvp:device-settings", apply);
    };
  }, []);

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
