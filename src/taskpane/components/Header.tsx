import React from "react";
import { ChatSession } from "../types";
import { SessionSwitcher } from "./SessionSwitcher";

interface HeaderProps {
  onOpenSettings: () => void;
  onBack?: () => void;
  showBack?: boolean;
  showChatActions?: boolean;
  sessions?: ChatSession[];
  activeSessionId?: string | null;
  chatDisabled?: boolean;
  onNewChat?: () => void;
  onSwitchSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => void;
  onReorderSessions?: (orderedIds: string[]) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export function Header({
  onOpenSettings,
  onBack,
  showBack,
  showChatActions,
  sessions = [],
  activeSessionId = null,
  chatDisabled,
  onNewChat,
  onSwitchSession,
  onRenameSession = () => undefined,
  onReorderSessions = () => undefined,
  onDeleteSession,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-left">
        {showBack && (
          <button className="icon-btn" onClick={onBack} title="返回">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.5 3.5L5.5 8l5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        )}
        <span className="brand">milei</span>
      </div>
      <div className="header-actions">
        {showChatActions && onSwitchSession && onDeleteSession && (
          <SessionSwitcher
            sessions={sessions}
            activeSessionId={activeSessionId}
            disabled={chatDisabled}
            onSwitch={onSwitchSession}
            onRename={onRenameSession}
            onReorder={onReorderSessions}
            onDelete={onDeleteSession}
          />
        )}
        {showChatActions && onNewChat && (
          <button
            className="icon-btn"
            onClick={onNewChat}
            title="新建对话"
            disabled={chatDisabled}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        )}
        <button className="icon-btn" onClick={onOpenSettings} title="设置">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="13" r="1.2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
