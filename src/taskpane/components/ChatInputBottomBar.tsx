import React from "react";
import { AppSettings, ChatSession } from "../types";
import { getVisibleModels } from "../services/modelService";
import { ContextUsageStats } from "../utils/chatHistoryBudget";
import { ChatBottomActions } from "./ChatBottomActions";
import { ContextUsageIndicator } from "./ContextUsageIndicator";
import { ModelSelector } from "./ModelSelector";

interface ChatInputBottomBarProps {
  settings: AppSettings;
  disabled?: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  contextUsage: ContextUsageStats;
  onModelChange: (modelId: string) => void;
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

export function ChatInputBottomBar({
  settings,
  disabled,
  sessions,
  activeSessionId,
  contextUsage,
  onModelChange,
  onNewChat,
  onToggleWebSearch,
  onOpenSettings,
  onSwitchSession,
  onRenameSession,
  onReorderSessions,
  onDeleteSession,
  onExportSessions,
  onImportSessions,
}: ChatInputBottomBarProps) {
  const modelOptions = getVisibleModels(settings);

  return (
    <div className="chat-input-bottom">
      <div className="chat-input-bottom-left">
        <ModelSelector
          options={modelOptions}
          value={settings.selectedModelId}
          disabled={disabled}
          onChange={onModelChange}
        />
        <ContextUsageIndicator usage={contextUsage} />
      </div>

      <ChatBottomActions
        sessions={sessions}
        activeSessionId={activeSessionId}
        disabled={disabled}
        webSearchEnabled={settings.webSearch?.enabled}
        onNewChat={onNewChat}
        onToggleWebSearch={onToggleWebSearch}
        onOpenSettings={onOpenSettings}
        onSwitchSession={onSwitchSession}
        onRenameSession={onRenameSession}
        onReorderSessions={onReorderSessions}
        onDeleteSession={onDeleteSession}
        onExportSessions={onExportSessions}
        onImportSessions={onImportSessions}
      />
    </div>
  );
}
