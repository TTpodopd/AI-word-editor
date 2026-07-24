import React, { useEffect, useRef, useState } from "react";
import {
  DEFAULT_OUTPUT_STYLE_ID,
  DEFAULT_OUTPUT_STYLE_OPTION,
  OUTPUT_STYLE_PRESETS,
  OutputStyleId,
  getOutputStyleDisplay,
  isOutputStyleActive,
} from "../prompts/outputStylePresets";

interface OutputStylePickerProps {
  value: OutputStyleId;
  disabled?: boolean;
  onChange: (styleId: OutputStyleId) => void;
}

function StyleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.8 4.2c0-1 .8-1.8 1.8-1.8h6.8c1 0 1.8.8 1.8 1.8v3.8c0 1-.8 1.8-1.8 1.8H7.2L3.8 13v-2.8c-1 0-1.8-.8-1.8-1.8V4.2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M5.2 6.2h5.6M5.2 8.1h4"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OutputStylePicker({ value, disabled, onChange }: OutputStylePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = getOutputStyleDisplay(value);
  const isActive = isOutputStyleActive(value);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (styleId: OutputStyleId) => {
    onChange(styleId);
    setOpen(false);
  };

  return (
    <div className="output-style-picker" ref={rootRef}>
      <button
        type="button"
        className={`icon-btn output-style-trigger${open ? " is-open" : ""}${isActive ? " is-active" : ""}`}
        title={isActive ? `输出风格：${selected.label}` : "输出风格：默认"}
        aria-label={isActive ? `输出风格：${selected.label}` : "输出风格：默认"}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <StyleIcon />
      </button>

      {open && (
        <div className="output-style-dropdown" role="listbox" aria-label="对话输出风格">
          <div className="output-style-dropdown-title">对话输出风格</div>
          <button
            type="button"
            role="option"
            aria-selected={!isActive}
            className={`output-style-option${!isActive ? " active" : ""}`}
            onClick={() => handleSelect(DEFAULT_OUTPUT_STYLE_ID)}
          >
            <span className="output-style-option-label">{DEFAULT_OUTPUT_STYLE_OPTION.label}</span>
            <span className="output-style-option-desc">{DEFAULT_OUTPUT_STYLE_OPTION.description}</span>
          </button>
          {OUTPUT_STYLE_PRESETS.map((item) => {
            const isSelected = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`output-style-option${isSelected ? " active" : ""}`}
                onClick={() => handleSelect(item.id)}
              >
                <span className="output-style-option-label">{item.label}</span>
                <span className="output-style-option-desc">{item.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
