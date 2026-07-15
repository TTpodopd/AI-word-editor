import React, { useCallback, useEffect, useState } from "react";
import { ChatConversation } from "./components/ChatConversation";
import { ChatInput } from "./components/ChatInput";
import { SettingsPanel } from "./components/SettingsPanel";
import { SettingsHeader } from "./components/SettingsHeader";
import { SelectionBar } from "./components/SelectionBar";
import { useSelection } from "./hooks/useSelection";
import { useViewportScale } from "./hooks/useViewportScale";
import { useChat } from "./hooks/useChat";
import { ActionType, AppSettings, AppView, DEFAULT_SETTINGS, PendingAttachment } from "./types";
import { getActionById } from "./prompts/actions";
import { ensureOfficeReady, loadSettings, saveSettings, saveSelectedModel, saveWebSearchEnabled } from "./services/storageService";
import { ensureSelectedModelVisible } from "./services/modelService";
import { applyText, captureCursor, clearTrackedRange } from "./services/wordService";
import { applyFormFillContent, clearFormFillScope, resolveFormFillData } from "./services/formFillService";
import { getInsertFirstLineIndentChars } from "./utils/textFormat";
import { applyThemeColor } from "./utils/theme";

export function App() {
  const [view, setView] = useState<AppView>("chat");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toast, setToast] = useState("");

  const { selection } = useSelection();
  useViewportScale();

  const {
    messages,
    sessions,
    activeSessionId,
    loading,
    editingMessageId,
    sendMessage,
    runAction,
    runDirectAction,
    regenerateMessage,
    editAndResend,
    startEditMessage,
    cancelEditMessage,
    deleteMessage,
    switchSession,
    renameSession,
    reorderSessions,
    deleteSession,
    newConversation,
  } = useChat(settings);

  useEffect(() => {
    ensureOfficeReady().then(() =>
      loadSettings().then((loaded) => {
        const normalized = ensureSelectedModelVisible(loaded);
        setSettings(normalized);
        applyThemeColor(normalized.themeColorId);
        if (normalized.selectedModelId !== loaded.selectedModelId) {
          saveSettings(normalized);
        }
      })
    );
  }, []);

  useEffect(() => {
    if (view === "chat") {
      applyThemeColor(settings.themeColorId);
    }
  }, [view, settings.themeColorId]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2500);
  };

  const handleSend = useCallback(
    async (message: string, attachments?: PendingAttachment[]): Promise<string | null> => {
      const error = await sendMessage(
        message,
        selection.hasSelection ? selection.text : undefined,
        attachments
      );
      if (error) showToast(error);
      return error;
    },
    [sendMessage, selection.hasSelection, selection.text]
  );

  const handleSlashAction = useCallback(
    (actionId: string) => {
      runAction(actionId as ActionType, selection.hasSelection ? selection.text : undefined);
    },
    [runAction, selection.hasSelection, selection.text]
  );

  const handleQuickAction = useCallback(
    async (actionId: string) => {
      const action = getActionById(actionId as ActionType);
      const error = await runDirectAction(actionId as ActionType, selection.text);
      if (error) {
        showToast(error);
      } else {
        showToast(`已${action?.label ?? "处理"}选中文本`);
      }
    },
    [runDirectAction, selection.text]
  );

  const handleApply = useCallback(
    async (content: string, _mode: "replace" | "insert", formFill?: boolean) => {
      if (formFill) {
        const result = await applyFormFillContent(content);
        if (result.success) {
          showToast(`已在选中区域填充 ${result.filledCount} 个字段`);
        } else {
          showToast(result.error || "填充失败");
        }
        return;
      }

      const formData = resolveFormFillData(content);
      if (formData) {
        const result = await applyFormFillContent(content);
        if (result.success) {
          showToast(`已在选中区域填充 ${result.filledCount} 个字段`);
        } else {
          showToast(result.error || "填充失败");
        }
        return;
      }

      await captureCursor();

      const latestSettings = await loadSettings();
      const applyOptions = {
        firstLineIndentChars: getInsertFirstLineIndentChars(latestSettings, false),
      };

      const result = await applyText(content, applyOptions);
      if (result.success) {
        showToast("已插入到文档");
        clearTrackedRange();
      } else {
        showToast(result.error || "写入失败");
      }
    },
    []
  );

  const handleModelChange = useCallback(async (modelId: string) => {
    setSettings((prev) => ({ ...prev, selectedModelId: modelId }));
    await saveSelectedModel(modelId);
  }, []);

  const handleToggleWebSearch = useCallback(async () => {
    const nextEnabled = !settings.webSearch?.enabled;
    if (nextEnabled && !settings.webSearch?.apiKey?.trim()) {
      showToast("请先在设置中配置 Tavily API Key");
      setView("settings");
      return;
    }

    const nextSettings = {
      ...settings,
      webSearch: { ...settings.webSearch, enabled: nextEnabled },
    };
    setSettings(nextSettings);
    await saveWebSearchEnabled(nextEnabled);
    showToast(nextEnabled ? "已开启联网搜索" : "已关闭联网搜索");
  }, [settings]);

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await saveSettings(newSettings);
      setSettings(newSettings);
      applyThemeColor(newSettings.themeColorId);
      setView("chat");
      showToast("设置已保存");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "设置保存失败");
    }
  }, []);

  const handleEditResend = useCallback(
    (messageId: string, content: string) => {
      editAndResend(messageId, content, selection.hasSelection ? selection.text : undefined);
    },
    [editAndResend, selection.hasSelection, selection.text]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      void deleteMessage(messageId);
    },
    [deleteMessage]
  );

  const handleNewChat = useCallback(async () => {
    await newConversation();
    clearTrackedRange();
    clearFormFillScope();
  }, [newConversation]);

  return (
    <div className="app-container chat-layout">
      {view === "settings" ? (
        <>
          <SettingsHeader
            onBack={() => {
              applyThemeColor(settings.themeColorId);
              setView("chat");
            }}
          />
          <main className="app-main settings-main">
            <SettingsPanel settings={settings} onSave={handleSaveSettings} />
          </main>
        </>
      ) : (
        <>
          <div className="chat-main">
            {selection.hasSelection && (
              <div className="selection-strip">
                <SelectionBar
                  text={selection.text}
                  charCount={selection.charCount}
                  onAction={handleQuickAction}
                  loading={loading}
                  compact
                />
              </div>
            )}

            <ChatConversation
              messages={messages}
              loading={loading}
              editingMessageId={editingMessageId}
              onApply={handleApply}
              onRegenerate={regenerateMessage}
              onStartEdit={startEditMessage}
              onCancelEdit={cancelEditMessage}
              onEditResend={handleEditResend}
              onDelete={handleDeleteMessage}
              onNotify={showToast}
              onQuickAction={handleQuickAction}
              hasSelection={selection.hasSelection}
            />
          </div>

          {toast && <div className="chat-toast">{toast}</div>}

          <ChatInput
            settings={settings}
            hasSelection={selection.hasSelection}
            selectionText={selection.text}
            selectionCharCount={selection.charCount}
            disabled={loading}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onModelChange={handleModelChange}
            onSend={handleSend}
            onSlashAction={handleSlashAction}
            onNewChat={handleNewChat}
            onOpenSettings={() => setView("settings")}
            onToggleWebSearch={handleToggleWebSearch}
            onSwitchSession={switchSession}
            onRenameSession={renameSession}
            onReorderSessions={reorderSessions}
            onDeleteSession={deleteSession}
            onError={showToast}
            onNotify={showToast}
          />
        </>
      )}
    </div>
  );
}
