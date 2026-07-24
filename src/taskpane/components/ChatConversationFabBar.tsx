import React from "react";
import { ChatSession } from "../types";
import { NewChatFab } from "./NewChatFab";
import { SessionSwitcher } from "./SessionSwitcher";

interface ChatConversationFabBarProps {
  disabled?: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat?: () => void;
  onSwitchSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onReorderSessions: (orderedIds: string[]) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSessions?: () => void | Promise<void>;
  onImportSessions?: (file: File) => void | Promise<string | null>;
}

export function ChatConversationFabBar({
  disabled,
  sessions,
  activeSessionId,
  onNewChat,
  onSwitchSession,
  onRenameSession,
  onReorderSessions,
  onDeleteSession,
  onExportSessions,
  onImportSessions,
}: ChatConversationFabBarProps) {
  return (
    <div className="chat-conversation-fab-bar">
      {onNewChat && <NewChatFab disabled={disabled} onClick={onNewChat} />}
      <SessionSwitcher
        sessions={sessions}
        activeSessionId={activeSessionId}
        disabled={disabled}
        dropUp
        triggerClassName="chat-conversation-fab"
        wrapperClassName="chat-conversation-fab-wrap"
        onSwitch={onSwitchSession}
        onRename={onRenameSession}
        onReorder={onReorderSessions}
        onDelete={onDeleteSession}
        onExportSessions={onExportSessions}
        onImportSessions={onImportSessions}
      />
    </div>
  );
}
