import React from "react";
import { THEME_COLOR_PRESETS, ThemeColorId } from "../constants/themeColors";

interface ThemeColorSettingsPanelProps {
  value: ThemeColorId;
  onChange: (value: ThemeColorId) => void;
}

export function ThemeColorSettingsPanel({ value, onChange }: ThemeColorSettingsPanelProps) {
  return (
    <div className="theme-color-settings">
        <span className="settings-hint">马卡龙 / 多巴胺 / 克莱因蓝等融合色系，影响按钮、高亮与装饰渐变。</span>
      <div className="theme-color-grid" role="radiogroup" aria-label="主题颜色">
        {THEME_COLOR_PRESETS.map((preset) => {
          const selected = value === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`theme-color-option${selected ? " selected" : ""}`}
              onClick={() => onChange(preset.id)}
              title={preset.label}
            >
              <span className="theme-color-swatch" style={{ backgroundColor: preset.accent }}>
                {selected && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M3 7.2L5.8 10L11 4.6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="theme-color-label">{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
