// Lightweight language preference (per device). Spanish content fields fall
// back to English when a translation is missing.
import { useEffect, useState } from "react";

export type Lang = "en" | "es";
const KEY = "mvp.lang";

export function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(KEY) === "es" ? "es" : "en";
}

export function writeLang(lang: Lang) {
  localStorage.setItem(KEY, lang);
  window.dispatchEvent(new CustomEvent("mvp-lang", { detail: lang }));
}

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    setLang(readLang());
    const on = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener("mvp-lang", on);
    return () => window.removeEventListener("mvp-lang", on);
  }, []);
  return lang;
}

/** Pick the Spanish variant when available and selected. */
export function pick(lang: Lang, en: string | null | undefined, es: string | null | undefined): string {
  if (lang === "es" && es && es.trim()) return es;
  return en ?? "";
}
