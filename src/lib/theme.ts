// Palette presets. Each maps to two CSS variables: --brand and --brand-accent.
// Values are oklch strings.

export type PaletteName =
  | "ocean"
  | "sunset"
  | "forest"
  | "aurora"
  | "monochrome"
  | "coral"
  | "royal";

export interface Palette {
  name: PaletteName;
  label: string;
  brand: string;
  accent: string;
}

export const PALETTES: Record<PaletteName, Palette> = {
  ocean: { name: "ocean", label: "Ocean", brand: "oklch(0.72 0.15 220)", accent: "oklch(0.78 0.14 175)" },
  sunset: { name: "sunset", label: "Sunset", brand: "oklch(0.72 0.18 40)", accent: "oklch(0.68 0.22 15)" },
  forest: { name: "forest", label: "Forest", brand: "oklch(0.7 0.15 150)", accent: "oklch(0.78 0.14 100)" },
  aurora: { name: "aurora", label: "Aurora", brand: "oklch(0.72 0.2 280)", accent: "oklch(0.78 0.17 175)" },
  monochrome: { name: "monochrome", label: "Monochrome", brand: "oklch(0.85 0.01 250)", accent: "oklch(0.7 0.02 250)" },
  coral: { name: "coral", label: "Coral", brand: "oklch(0.75 0.16 25)", accent: "oklch(0.72 0.15 340)" },
  royal: { name: "royal", label: "Royal", brand: "oklch(0.62 0.2 265)", accent: "oklch(0.75 0.14 300)" },
};

export function paletteFromValue(value: unknown): Palette {
  if (typeof value === "string" && value in PALETTES) {
    return PALETTES[value as PaletteName];
  }
  if (value && typeof value === "object" && "brand" in value && "accent" in value) {
    const v = value as { brand: string; accent: string };
    return { name: "ocean", label: "Custom", brand: v.brand, accent: v.accent };
  }
  return PALETTES.ocean;
}

export function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--brand", palette.brand);
  document.documentElement.style.setProperty("--brand-accent", palette.accent);
}
