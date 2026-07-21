import React, { useMemo } from "react";
import { getActionsForSelection } from "../prompts/actions";
import {
  detectSelectionContentKind,
  getSelectionContentKindLabel,
} from "../utils/selectionContentType";

interface ChatEmptyStateProps {
  hasSelection: boolean;
  selectionText?: string;
  onQuickAction: (actionId: string) => void;
}

export function ChatEmptyState({
  hasSelection,
  selectionText = "",
  onQuickAction,
}: ChatEmptyStateProps) {
  const contentKind = useMemo(
    () => (hasSelection ? detectSelectionContentKind(selectionText) : "text"),
    [hasSelection, selectionText]
  );
  const actions = useMemo(
    () => getActionsForSelection(selectionText, hasSelection),
    [hasSelection, selectionText]
  );
  const kindLabel = getSelectionContentKindLabel(contentKind);

  return (
    <div className="chat-empty">
      <div className="chat-empty-icon">👋</div>
      <h3 className="chat-empty-title">你好，我是 AI 编辑助手</h3>
      <p className="chat-empty-desc">
        {hasSelection
          ? `已检测到${kindLabel}选区，可输入指令或使用下方${kindLabel}快捷操作`
          : "直接输入提示词开始对话，或选中文本后进行编辑"}
      </p>
      {hasSelection && (
        <div className="chat-quick-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              className="chat-quick-btn"
              onClick={() => onQuickAction(action.id)}
              title={action.slashCommand}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
