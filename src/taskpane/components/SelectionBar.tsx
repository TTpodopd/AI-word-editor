import React, { useMemo } from "react";
import { ActionType } from "../types";
import { getActionsForSelection } from "../prompts/actions";
import {
  detectSelectionContentKind,
  getSelectionContentKindLabel,
} from "../utils/selectionContentType";

interface SelectionBarProps {
  text: string;
  charCount: number;
  onAction: (action: ActionType) => void;
  loading: boolean;
  compact?: boolean;
  quickApplyEnabled?: boolean;
  onQuickApplyChange?: (enabled: boolean) => void;
}

function SelectionQuickApplyToggle({
  quickApplyEnabled,
  disabled,
  onQuickApplyChange,
}: {
  quickApplyEnabled: boolean;
  disabled?: boolean;
  onQuickApplyChange?: (enabled: boolean) => void;
}) {
  if (!onQuickApplyChange) return null;

  return (
    <label
      className="selection-quick-toggle"
      title={
        quickApplyEnabled
          ? "关闭后将先在对话区预览，再确认写入"
          : "开启后将直接替换选中文本，跳过预览"
      }
    >
      <input
        type="checkbox"
        checked={!quickApplyEnabled}
        disabled={disabled}
        onChange={(event) => onQuickApplyChange(!event.target.checked)}
      />
      <span>预览</span>
    </label>
  );
}

export function SelectionBar({
  text,
  charCount,
  onAction,
  loading,
  compact,
  quickApplyEnabled = false,
  onQuickApplyChange,
}: SelectionBarProps) {
  const contentKind = useMemo(() => detectSelectionContentKind(text), [text]);
  const actions = useMemo(() => getActionsForSelection(text, true), [text]);
  const kindLabel = getSelectionContentKindLabel(contentKind);
  const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;

  if (compact) {
    return (
      <div className="selection-bar compact">
        <span className="selection-badge">
          已选 {charCount} 字 · {kindLabel}
        </span>
        <div className="action-buttons">
          {actions.map((action) => (
            <button
              key={action.id}
              className="action-btn compact-btn"
              onClick={() => onAction(action.id)}
              disabled={loading}
              title={action.slashCommand}
            >
              {action.label}
            </button>
          ))}
        </div>
        <SelectionQuickApplyToggle
          quickApplyEnabled={quickApplyEnabled}
          disabled={loading}
          onQuickApplyChange={onQuickApplyChange}
        />
      </div>
    );
  }

  return (
    <div className="selection-bar">
      <div className="selection-info">
        已选中 {charCount} 字 · {kindLabel}
        <div className="selection-preview">{preview}</div>
      </div>
      <div className="action-buttons">
        {actions.map((action) => (
          <button
            key={action.id}
            className="action-btn"
            onClick={() => onAction(action.id)}
            disabled={loading}
            title={action.slashCommand}
          >
            {action.label}
          </button>
        ))}
        <SelectionQuickApplyToggle
          quickApplyEnabled={quickApplyEnabled}
          disabled={loading}
          onQuickApplyChange={onQuickApplyChange}
        />
      </div>
    </div>
  );
}
