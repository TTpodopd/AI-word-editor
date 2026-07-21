import React, { useEffect, useState } from "react";
import { prepareTextForWordDocument } from "../utils/textFormat";
import { openExternalLink } from "../utils/openExternalLink";
import { formatFormFillPreview, resolveFormFillData } from "../services/formFillService";
import { UIMessage, MessageSearchInfo } from "../types";
import { TextDiffPreview } from "./TextDiffPreview";

interface MessageBubbleProps {
  message: UIMessage;
  editing: boolean;
  disabled: boolean;
  onApply: (content: string, applyMode: "replace" | "insert", formFill?: boolean, referenceText?: string) => void;
  onRegenerate: (messageId: string) => void;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onEditResend: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onStop?: () => void;
  onNotify?: (text: string) => void;
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

function SearchSourcesPanel({
  searchInfo,
  onNotify,
}: {
  searchInfo: MessageSearchInfo;
  onNotify?: (text: string) => void;
}) {
  const resultCount = searchInfo.results.filter((item) => item.url?.trim()).length;
  const allUrls = searchInfo.results.map((item) => item.url.trim()).filter(Boolean).join("\n");

  const handleCopyUrl = async (url: string) => {
    const copied = await copyToClipboard(url);
    onNotify?.(copied ? "链接已复制" : "复制失败");
  };

  const handleCopyAllUrls = async () => {
    if (!allUrls) return;
    const copied = await copyToClipboard(allUrls);
    onNotify?.(copied ? "全部链接已复制" : "复制失败");
  };

  return (
    <div className={`message-search-sources${searchInfo.error ? " message-search-sources--error" : ""}`}>
      <div className="message-search-header">
        <span className="message-search-label">联网搜索</span>
        <span className="message-search-query">「{searchInfo.query}」</span>
        {!searchInfo.error && (
          <span className="message-search-count">
            {resultCount > 0 ? `${resultCount} 个来源` : "未找到来源"}
          </span>
        )}
        {resultCount > 1 && (
          <button type="button" className="message-search-copy-all" onClick={() => void handleCopyAllUrls()}>
            复制全部链接
          </button>
        )}
      </div>
      {searchInfo.error && (
        <div className="message-search-error">搜索失败：{searchInfo.error}</div>
      )}
      {resultCount > 0 && (
        <ul className="message-search-list">
          {searchInfo.results.map((item, index) => {
            const url = item.url?.trim();
            if (!url) return null;

            return (
              <li key={`${url}-${index}`} className="message-search-item">
                <div className="message-search-item-title">
                  <span className="message-search-index">{index + 1}.</span>
                  <button
                    type="button"
                    className="message-search-title-link"
                    onClick={() => openExternalLink(url)}
                    title={item.content?.trim() || url}
                  >
                    {item.title?.trim() || url}
                  </button>
                </div>
                <div className="message-search-url-row">
                  <button
                    type="button"
                    className="message-search-url-link"
                    onClick={() => openExternalLink(url)}
                    title="在浏览器中打开"
                  >
                    {url}
                  </button>
                  <button
                    type="button"
                    className="message-search-copy-btn"
                    onClick={() => void handleCopyUrl(url)}
                    title="复制链接"
                  >
                    复制
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
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

function CopyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.5 10.5h-1a1 1 0 01-1-1v-7a1 1 0 011-1h7a1 1 0 011 1v1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
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
  onStop,
  onNotify,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [editText, setEditText] = useState(message.content);

  useEffect(() => {
    if (editing) setEditText(message.content);
  }, [editing, message.content]);

  const handleCopy = async (text: string) => {
    const copied = await copyToClipboard(text);
    onNotify?.(copied ? "已复制" : "复制失败");
  };

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
              title="复制"
              onClick={() => handleCopy(message.content)}
              disabled={disabled}
            >
              <CopyIcon />
            </button>
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
    const streamingContent = message.content.trim();
    return (
      <div className="message-row assistant">
        <div className="message-avatar">AI</div>
        <div className="message-bubble assistant-bubble loading-bubble">
          {message.searchInfo && (
            <SearchSourcesPanel searchInfo={message.searchInfo} onNotify={onNotify} />
          )}
          {streamingContent ? (
            <div className="message-content assistant-content streaming-content">{streamingContent}</div>
          ) : (
            <div className="typing-dots">
              <span />
              <span />
              <span />
            </div>
          )}
          {onStop && (
            <div className="message-actions">
              <button className="msg-action-btn stop-btn" onClick={onStop} disabled={disabled}>
                停止
              </button>
            </div>
          )}
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
              className="msg-icon-btn"
              title="复制"
              onClick={() => handleCopy(message.error || "请求失败")}
              disabled={disabled}
            >
              <CopyIcon />
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

  const formData = resolveFormFillData(message.content);
  const isFormFillMessage = message.formFill || !!formData;
  const revisedContent = formData
    ? formatFormFillPreview(formData)
    : prepareTextForWordDocument(message.content, message.sourceText || "");
  const hasReplacePreview = !!message.sourceText && !isFormFillMessage;
  const applyMode = message.applyMode ?? "insert";
  const applyLabel = isFormFillMessage
    ? "填充到文档"
    : applyMode === "replace"
      ? "确定替换"
      : "插入到文档";
  const copyContent = revisedContent;

  return (
    <div className="message-row assistant">
      <div className="message-avatar">AI</div>
      <div className="message-bubble assistant-bubble">
        {message.searchInfo && (
          <SearchSourcesPanel searchInfo={message.searchInfo} onNotify={onNotify} />
        )}
        <div className="message-content assistant-content">
          {hasReplacePreview ? (
            <TextDiffPreview
              original={message.sourceText!}
              revised={revisedContent}
              actionLabel={message.actionLabel}
            />
          ) : (
            revisedContent
          )}
        </div>
        <div className="message-actions">
          <button
            className="msg-action-btn primary"
            onClick={() => onApply(message.content, applyMode, isFormFillMessage, message.sourceText)}
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
            className="msg-action-btn"
            title="复制"
            onClick={() => handleCopy(copyContent)}
            disabled={disabled}
          >
            复制
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
