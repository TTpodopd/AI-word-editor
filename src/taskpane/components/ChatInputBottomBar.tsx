import React from "react";
import { AppSettings } from "../types";
import { getVisibleModels } from "../services/modelService";
import { DEFAULT_OUTPUT_STYLE_ID, OutputStyleId } from "../prompts/outputStylePresets";
import { ChatBottomActionId, DEFAULT_CHAT_BOTTOM_ACTION_ORDER } from "../constants/chatBottomActions";
import { ContextUsageStats } from "../utils/chatHistoryBudget";
import { ChatBottomActions } from "./ChatBottomActions";
import { ContextUsageIndicator } from "./ContextUsageIndicator";
import { ModelSelector } from "./ModelSelector";

interface ChatInputBottomBarProps {
  settings: AppSettings;
  disabled?: boolean;
  contextUsage: ContextUsageStats;
  onModelChange: (modelId: string) => void;
  onOutputStyleChange: (styleId: OutputStyleId) => void;
  onToggleWebSearch: () => void;
  onOpenSettings: () => void;
  onReorderBottomActions?: (order: ChatBottomActionId[]) => void;
}

export function ChatInputBottomBar({
  settings,
  disabled,
  contextUsage,
  onModelChange,
  onOutputStyleChange,
  onToggleWebSearch,
  onOpenSettings,
  onReorderBottomActions,
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
        actionOrder={settings.chatBottomActionOrder || DEFAULT_CHAT_BOTTOM_ACTION_ORDER}
        disabled={disabled}
        webSearchEnabled={settings.webSearch?.enabled}
        outputStyleId={settings.outputStyleId || DEFAULT_OUTPUT_STYLE_ID}
        onOutputStyleChange={onOutputStyleChange}
        onReorderActions={onReorderBottomActions || (() => undefined)}
        onToggleWebSearch={onToggleWebSearch}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
