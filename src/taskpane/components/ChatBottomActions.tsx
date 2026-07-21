import React from "react";
import { ChatSession } from "../types";
import { SessionSwitcher } from "./SessionSwitcher";

interface ChatBottomActionsProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  disabled?: boolean;
  webSearchEnabled?: boolean;
  onNewChat: () => void;
  onToggleWebSearch: () => void;
  onOpenSettings: () => void;
  onSwitchSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onReorderSessions: (orderedIds: string[]) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSessions?: () => void | Promise<void>;
  onImportSessions?: (file: File) => void | Promise<string | null>;
}

export function ChatBottomActions({
  sessions,
  activeSessionId,
  disabled,
  webSearchEnabled,
  onNewChat,
  onToggleWebSearch,
  onOpenSettings,
  onSwitchSession,
  onRenameSession,
  onReorderSessions,
  onDeleteSession,
  onExportSessions,
  onImportSessions,
}: ChatBottomActionsProps) {
  return (
    <div className="chat-bottom-actions">
      <SessionSwitcher
        sessions={sessions}
        activeSessionId={activeSessionId}
        disabled={disabled}
        dropUp
        onSwitch={onSwitchSession}
        onRename={onRenameSession}
        onReorder={onReorderSessions}
        onDelete={onDeleteSession}
        onExportSessions={onExportSessions}
        onImportSessions={onImportSessions}
      />
      <button className="icon-btn" title="新建对话" onClick={onNewChat} disabled={disabled}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button
        className={`icon-btn web-search-toggle${webSearchEnabled ? " active" : ""}`}
        title={webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
        onClick={onToggleWebSearch}
        disabled={disabled}
        aria-pressed={!!webSearchEnabled}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M1.5 8h13M8 1.8c-1.8 2-2.8 4.2-2.8 6.2S6.2 12.2 8 14.2c1.8-2 2.8-4.2 2.8-6.2S9.8 3.8 8 1.8z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button className="icon-btn" title="设置" onClick={onOpenSettings} disabled={disabled}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.2" />
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="8" cy="13" r="1.2" />
        </svg>
      </button>
    </div>
  );
}
