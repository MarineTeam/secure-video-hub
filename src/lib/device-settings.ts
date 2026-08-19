// Per-device preferences. Stored in localStorage so each device (web or PWA)
// keeps its own theme, playback and download behaviour.
import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

export interface DeviceSettings {
  themeMode: ThemeMode;
  language: string;
  autoplayNext: boolean;
  defaultPlaybackRate: number;
  downloadOnWifiOnly: boolean;
  downloadQuality: "auto" | "720p" | "1080p";
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  themeMode: "system",
  language: "en",
  autoplayNext: true,
  defaultPlaybackRate: 1,
  downloadOnWifiOnly: true,
  downloadQuality: "auto",
};

const KEY = "mvp.device-settings";
const EVENT = "mvp:device-settings";

export function readDeviceSettings(): DeviceSettings {
  if (typeof window === "undefined") return DEFAULT_DEVICE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DEVICE_SETTINGS;
    return { ...DEFAULT_DEVICE_SETTINGS, ...(JSON.parse(raw) as Partial<DeviceSettings>) };
  } catch {
    return DEFAULT_DEVICE_SETTINGS;
  }
}

export function writeDeviceSettings(next: DeviceSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Hydration-safe hook: returns defaults on the server, real values after mount. */
export function useDeviceSettings() {
  const [settings, setSettings] = useState<DeviceSettings>(DEFAULT_DEVICE_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(readDeviceSettings());
    setReady(true);
    const sync = () => setSettings(readDeviceSettings());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<DeviceSettings>) => {
    const next = { ...readDeviceSettings(), ...patch };
    writeDeviceSettings(next);
    setSettings(next);
  }, []);

  return { settings, update, ready };
}
