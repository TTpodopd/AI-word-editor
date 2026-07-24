import React, { useEffect, useRef } from "react";
import { ChatSession, UIMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ChatConversationFabBar } from "./ChatConversationFabBar";
import { ChatEmptyState } from "./ChatEmptyState";
import { WelcomeView } from "./WelcomeView";
import { ChatCloudBackground } from "./ChatCloudBackground";

interface ChatConversationProps {
  messages: UIMessage[];
  loading: boolean;
  editingMessageId: string | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onApply: (content: string, applyMode: "replace" | "insert", referenceText?: string) => void;
  onRegenerate: (messageId: string) => void;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onEditResend: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onStop: () => void;
  onNotify?: (text: string) => void;
  onQuickAction: (actionId: string) => void;
  hasSelection: boolean;
  selectionText?: string;
  onWelcomeCardClick?: (cardId: string) => void;
  onNewChat?: () => void;
  onSwitchSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onReorderSessions: (orderedIds: string[]) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSessions?: () => void | Promise<void>;
  onImportSessions?: (file: File) => void | Promise<string | null>;
}

export function ChatConversation({
  messages,
  loading,
  editingMessageId,
  sessions,
  activeSessionId,
  onApply,
  onRegenerate,
  onStartEdit,
  onCancelEdit,
  onEditResend,
  onDelete,
  onStop,
  onNotify,
  onQuickAction,
  hasSelection,
  selectionText,
  onWelcomeCardClick,
  onNewChat,
  onSwitchSession,
  onRenameSession,
  onReorderSessions,
  onDeleteSession,
  onExportSessions,
  onImportSessions,
}: ChatConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fabBar = (
    <ChatConversationFabBar
      disabled={loading}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onNewChat={onNewChat}
      onSwitchSession={onSwitchSession}
      onRenameSession={onRenameSession}
      onReorderSessions={onReorderSessions}
      onDeleteSession={onDeleteSession}
      onExportSessions={onExportSessions}
      onImportSessions={onImportSessions}
    />
  );

  if (messages.length === 0) {
    return (
      <div className="chat-conversation">
        <ChatCloudBackground />
        {onWelcomeCardClick ? (
          <WelcomeView onCardClick={onWelcomeCardClick} />
        ) : (
          <ChatEmptyState
            hasSelection={hasSelection}
            selectionText={selectionText}
            onQuickAction={onQuickAction}
          />
        )}
        {fabBar}
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
            onStop={onStop}
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
      {fabBar}
    </div>
  );
}
