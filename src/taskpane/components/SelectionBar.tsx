import React from "react";
import { ActionType } from "../types";
import { ACTION_PROMPTS } from "../prompts/actions";

interface SelectionBarProps {
  text: string;
  charCount: number;
  onAction: (action: ActionType) => void;
  loading: boolean;
  compact?: boolean;
}

export function SelectionBar({ text, charCount, onAction, loading, compact }: SelectionBarProps) {
  const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;

  if (compact) {
    return (
      <div className="selection-bar compact">
        <span className="selection-badge">已选 {charCount} 字</span>
        <div className="action-buttons">
          {ACTION_PROMPTS.map((action) => (
            <button
              key={action.id}
              className="action-btn compact-btn"
              onClick={() => onAction(action.id)}
              disabled={loading}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="selection-bar">
      <div className="selection-info">
        已选中 {charCount} 字
        <div className="selection-preview">{preview}</div>
      </div>
      <div className="action-buttons">
        {ACTION_PROMPTS.map((action) => (
          <button
            key={action.id}
            className="action-btn"
            onClick={() => onAction(action.id)}
            disabled={loading}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
