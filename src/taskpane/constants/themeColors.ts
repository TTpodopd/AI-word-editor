export type ThemeColorId =
  | "klein-blue"
  | "periwinkle"
  | "dopamine-green"
  | "macaron-red"
  | "taro-purple"
  | "peach-coral"
  | "lemon-soda";

export interface ThemeColorPreset {
  id: ThemeColorId;
  label: string;
  accent: string;
}

export const DEFAULT_THEME_COLOR_ID: ThemeColorId = "klein-blue";

export const THEME_COLOR_PRESETS: ThemeColorPreset[] = [
  { id: "klein-blue", label: "克莱因蓝", accent: "#0047E8" },
  { id: "periwinkle", label: "长春花蓝", accent: "#6667AB" },
  { id: "dopamine-green", label: "多巴胺绿", accent: "#00C49A" },
  { id: "macaron-red", label: "马卡龙红", accent: "#D9728F" },
  { id: "taro-purple", label: "芋泥紫", accent: "#8B6FC9" },
  { id: "peach-coral", label: "蜜桃珊瑚", accent: "#FF8566" },
  { id: "lemon-soda", label: "柠檬苏打", accent: "#E8A830" },
];

const LEGACY_THEME_COLOR_MAP: Record<string, ThemeColorId> = {
  purple: "periwinkle",
  blue: "klein-blue",
  teal: "dopamine-green",
  green: "dopamine-green",
  orange: "peach-coral",
  rose: "macaron-red",
  red: "macaron-red",
};

export function isThemeColorId(value: unknown): value is ThemeColorId {
  return THEME_COLOR_PRESETS.some((preset) => preset.id === value);
}

export function resolveThemeColorId(value: unknown): ThemeColorId {
  if (isThemeColorId(value)) return value;
  if (typeof value === "string" && value in LEGACY_THEME_COLOR_MAP) {
    return LEGACY_THEME_COLOR_MAP[value];
  }
  return DEFAULT_THEME_COLOR_ID;
}

export function getThemeColorPreset(id?: string): ThemeColorPreset {
  const resolvedId = resolveThemeColorId(id);
  return THEME_COLOR_PRESETS.find((preset) => preset.id === resolvedId) ?? THEME_COLOR_PRESETS[0];
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixWithWhite(hex: string, whiteRatio: number): string {
  const { r, g, b } = parseHex(hex);
  const ratio = whiteRatio / 100;
  return toHex(r + (255 - r) * ratio, g + (255 - g) * ratio, b + (255 - b) * ratio);
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const factor = 1 - amount / 100;
  return toHex(r * factor, g * factor, b * factor);
}

function lighten(hex: string, amount: number): string {
  return mixWithWhite(hex, amount);
}

export function buildThemeCssVariables(accent: string): Record<string, string> {
  const { r, g, b } = parseHex(accent);
  return {
    "--color-accent": accent,
    "--color-accent-hover": darken(accent, 12),
    "--color-accent-light": lighten(accent, 28),
    "--color-accent-soft": mixWithWhite(accent, 92),
    "--color-accent-muted": mixWithWhite(accent, 88),
    "--color-accent-surface": mixWithWhite(accent, 95),
    "--color-accent-border": mixWithWhite(accent, 75),
    "--color-accent-border-light": mixWithWhite(accent, 82),
    "--color-accent-focus": mixWithWhite(accent, 70),
    "--color-accent-rgb": `${r}, ${g}, ${b}`,
    "--color-purple-start": mixWithWhite(accent, 90),
    "--color-purple-end": mixWithWhite(accent, 78),
    "--color-cyan-start": mixWithWhite(accent, 93),
    "--color-cyan-end": mixWithWhite(accent, 84),
    "--color-pink-start": mixWithWhite(accent, 91),
    "--color-pink-end": mixWithWhite(accent, 82),
  };
}
