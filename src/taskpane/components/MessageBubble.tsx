import React, { useEffect, useState } from "react";
import { normalizeAssistantContent } from "../utils/textFormat";
import { UIMessage } from "../types";

interface MessageBubbleProps {
  message: UIMessage;
  editing: boolean;
  disabled: boolean;
  onApply: (content: string, applyMode: "replace" | "insert") => void;
  onRegenerate: (messageId: string) => void;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onEditResend: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
}

function PencilIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 4l2 2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function AttachmentList({ attachments }: { attachments: NonNullable<UIMessage["attachments"]> }) {
  return (
    <div className="message-attachments">
      {attachments.map((item) => (
        <div key={item.id} className={`message-attachment-chip message-attachment-chip--${item.kind}`}>
          <span className="message-attachment-icon">{item.kind === "image" ? "🖼" : "📄"}</span>
          <span className="message-attachment-name">{item.name}</span>
          {item.kind === "document" && item.textPreview && (
            <span className="message-attachment-preview">{item.textPreview}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6 4.5V3.8c0-.4.3-.8.8-.8h2.4c.4 0 .8.3.8.8V4.5M5.5 4.5v8.2c0 .6.4 1 1 1h3c.6 0 1-.4 1-1V4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 7v4M9 7v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function MessageBubble({
  message,
  editing,
  disabled,
  onApply,
  onRegenerate,
  onStartEdit,
  onCancelEdit,
  onEditResend,
  onDelete,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [editText, setEditText] = useState(message.content);

  useEffect(() => {
    if (editing) setEditText(message.content);
  }, [editing, message.content]);

  if (isUser) {
    if (editing) {
      return (
        <div className="message-row user">
          <div className="message-bubble user-bubble editing-bubble">
            <textarea
              className="message-edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              disabled={disabled}
            />
            <div className="message-actions">
              <button
                className="msg-action-btn primary"
                onClick={() => onEditResend(message.id, editText)}
                disabled={!editText.trim() || disabled}
              >
                重新发送
              </button>
              <button className="msg-action-btn" onClick={onCancelEdit} disabled={disabled}>
                取消
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="message-row user">
        <div className="message-bubble user-bubble">
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentList attachments={message.attachments} />
          )}
          <div className="message-content">{message.content}</div>
          <div className="message-actions user-actions">
            <button
              className="msg-icon-btn"
              title="编辑"
              onClick={() => onStartEdit(message.id)}
              disabled={disabled}
            >
              <PencilIcon />
            </button>
            <button
              className="msg-icon-btn msg-delete-btn"
              title="删除"
              onClick={() => onDelete(message.id)}
              disabled={disabled}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (message.status === "loading") {
    return (
      <div className="message-row assistant">
        <div className="message-avatar">AI</div>
        <div className="message-bubble assistant-bubble loading-bubble">
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="message-row assistant">
        <div className="message-avatar">AI</div>
        <div className="message-bubble assistant-bubble error-bubble">
          {message.error || "请求失败"}
          <div className="message-actions assistant-inline-actions">
            <button
              className="msg-icon-btn msg-delete-btn assistant-delete-btn"
              title="删除"
              onClick={() => onDelete(message.id)}
              disabled={disabled}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const applyLabel = "插入到文档";

  return (
    <div className="message-row assistant">
      <div className="message-avatar">AI</div>
      <div className="message-bubble assistant-bubble">
        <div className="message-content assistant-content">
          {normalizeAssistantContent(message.content)}
        </div>
        <div className="message-actions">
          <button
            className="msg-action-btn primary"
            onClick={() =>
              onApply(normalizeAssistantContent(message.content), "insert")
            }
            disabled={disabled}
          >
            {applyLabel}
          </button>
          <button
            className="msg-action-btn"
            onClick={() => onRegenerate(message.id)}
            disabled={disabled}
          >
            重新生成
          </button>
          <button
            className="msg-icon-btn msg-delete-btn assistant-delete-btn"
            title="删除"
            onClick={() => onDelete(message.id)}
            disabled={disabled}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
