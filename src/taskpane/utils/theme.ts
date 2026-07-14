import { buildThemeCssVariables, getThemeColorPreset } from "../constants/themeColors";

export function applyThemeColor(themeColorId?: string): void {
  const preset = getThemeColorPreset(themeColorId);
  const variables = buildThemeCssVariables(preset.accent);
  const root = document.documentElement;

  Object.entries(variables).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}
