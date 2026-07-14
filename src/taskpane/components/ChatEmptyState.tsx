import React from "react";
import { ACTION_PROMPTS } from "../prompts/actions";

interface ChatEmptyStateProps {
  hasSelection: boolean;
  onQuickAction: (actionId: string) => void;
}

export function ChatEmptyState({ hasSelection, onQuickAction }: ChatEmptyStateProps) {
  return (
    <div className="chat-empty">
      <div className="chat-empty-icon">👋</div>
      <h3 className="chat-empty-title">你好，我是 AI 编辑助手</h3>
      <p className="chat-empty-desc">
        {hasSelection
          ? "已检测到选中文本，可输入指令或点击快捷操作"
          : "直接输入提示词开始对话，或选中文本后进行编辑"}
      </p>
      {hasSelection && (
        <div className="chat-quick-actions">
          {ACTION_PROMPTS.map((action) => (
            <button
              key={action.id}
              className="chat-quick-btn"
              onClick={() => onQuickAction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
