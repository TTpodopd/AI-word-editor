import React, { useEffect, useRef } from "react";
import { UIMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatCloudBackground } from "./ChatCloudBackground";

interface ChatConversationProps {
  messages: UIMessage[];
  loading: boolean;
  editingMessageId: string | null;
  onApply: (content: string, applyMode: "replace" | "insert", formFill?: boolean) => void;
  onRegenerate: (messageId: string) => void;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onEditResend: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onNotify?: (text: string) => void;
  onQuickAction: (actionId: string) => void;
  hasSelection: boolean;
}

export function ChatConversation({
  messages,
  loading,
  editingMessageId,
  onApply,
  onRegenerate,
  onStartEdit,
  onCancelEdit,
  onEditResend,
  onDelete,
  onNotify,
  onQuickAction,
  hasSelection,
}: ChatConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0) {
    return (
      <div className="chat-conversation">
        <ChatCloudBackground />
        <ChatEmptyState hasSelection={hasSelection} onQuickAction={onQuickAction} />
      </div>
    );
  }

  return (
    <div className="chat-conversation">
      <ChatCloudBackground />
      <div className="chat-messages">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            editing={editingMessageId === message.id}
            disabled={loading}
            onApply={onApply}
            onRegenerate={onRegenerate}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onEditResend={onEditResend}
            onDelete={onDelete}
            onNotify={onNotify}
          />
        ))}
        {loading && messages[messages.length - 1]?.status !== "loading" && (
          <div className="chat-typing">
            <div className="typing-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
