import React, { useEffect, useRef, useState } from "react";
import { ModelConfig } from "../types";
import { ModelIcon } from "./ModelIcon";

interface ModelSelectorProps {
  options: ModelConfig[];
  value: string;
  disabled?: boolean;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ options, value, disabled, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.id === value) || options[0];

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

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setOpen(false);
  };

  return (
    <div className="model-selector model-selector-bottom" ref={rootRef}>
      <button
        type="button"
        className="model-selector-trigger"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ModelIcon model={selected} size={14} />
        <span className="model-selector-label">{selected?.label || "选择模型"}</span>
        <svg
          className={`model-selector-chevron${open ? " open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && options.length > 0 && (
        <div className="model-dropdown" role="listbox">
          {options.map((item) => {
            const isActive = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`model-option${isActive ? " active" : ""}`}
                onClick={() => handleSelect(item.id)}
              >
                <ModelIcon model={item} size={14} />
                <span className="model-option-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
