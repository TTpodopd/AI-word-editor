import React, { useCallback, useEffect, useState } from "react";
import { ChatConversation } from "./components/ChatConversation";
import { ChatInput, ChatInputDraft } from "./components/ChatInput";
import { ChatInputBottomBar } from "./components/ChatInputBottomBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { SettingsHeader } from "./components/SettingsHeader";
import { SelectionBar } from "./components/SelectionBar";
import { AppViewTabs } from "./components/AppViewTabs";
import { QuickCommandsPanel } from "./components/QuickCommandsPanel";
import { WritingAssistantPanel } from "./components/WritingAssistantPanel";
import { useSelection } from "./hooks/useSelection";
import { useViewportScale } from "./hooks/useViewportScale";
import { useChat } from "./hooks/useChat";
import { ActionType, AppSettings, AppView, DEFAULT_SETTINGS } from "./types";
import { ensureOfficeReady, loadSettings, saveSettings, saveSelectedModel, saveWebSearchEnabled } from "./services/storageService";
import { ensureSelectedModelVisible } from "./services/modelService";
import { applyText, captureCursor, captureSelection, clearTrackedRange, hasTrackedRange, readCurrentSelection } from "./services/wordService";
import { getInsertFirstLineIndentChars, prepareTextForWordDocument } from "./utils/textFormat";
import { applyThemeColor } from "./utils/theme";
import { localizeErrorMessage } from "./utils/localizeErrorMessage";
import { detectSelectionContentKind } from "./utils/selectionContentType";
import { ChatBottomActionId } from "./constants/chatBottomActions";
import { OutputStyleId, getOutputStyleDisplay, isOutputStyleActive } from "./prompts/outputStylePresets";

interface AppProps {
  showBrowserPreviewHint?: boolean;
}

export function App({ showBrowserPreviewHint = false }: AppProps) {
  const [view, setView] = useState<AppView>("chat");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toast, setToast] = useState("");
  const [writingTemplateId, setWritingTemplateId] = useState<string | undefined>(undefined);
  const [writingBusy, setWritingBusy] = useState(false);
  const [inputDraft, setInputDraft] = useState<ChatInputDraft | null>(null);

  const { selection } = useSelection();
  useViewportScale();

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2500);
  }, []);

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
    stopGeneration,
    switchSession,
    renameSession,
    reorderSessions,
    deleteSession,
    exportSessions,
    importSessions,
    contextUsage,
    newConversation,
    writingProject,
    updateWritingProject,
  } = useChat(settings, { onNotify: showToast, hasSelection: selection.hasSelection });

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
    if (view === "chat" || view === "writing" || view === "tools") {
      applyThemeColor(settings.themeColorId);
    }
  }, [view, settings.themeColorId]);

  const handleSend = useCallback(
    async (message: string): Promise<string | null> => {
      const error = await sendMessage(
        message,
        selection.hasSelection ? selection.text : undefined
      );
      if (error) showToast(error);
      return error;
    },
    [sendMessage, selection.hasSelection, selection.text, showToast]
  );

  const handleSlashAction = useCallback(
    async (actionId: string) => {
      if (settings.quickApplyEnabled) {
        const error = await runDirectAction(
          actionId as ActionType,
          selection.hasSelection ? selection.text : undefined
        );
        if (error) showToast(error);
        else showToast("已写入文档");
        return;
      }

      runAction(actionId as ActionType, selection.hasSelection ? selection.text : undefined);
    },
    [runAction, runDirectAction, selection.hasSelection, selection.text, settings.quickApplyEnabled]
  );

  const handleQuickAction = useCallback(
    async (actionId: string) => {
      if (settings.quickApplyEnabled) {
        const error = await runDirectAction(
          actionId as ActionType,
          selection.hasSelection ? selection.text : undefined
        );
        if (error) showToast(error);
        else showToast("已写入文档");
        return;
      }

      runAction(actionId as ActionType, selection.hasSelection ? selection.text : undefined);
    },
    [runAction, runDirectAction, selection.hasSelection, selection.text, settings.quickApplyEnabled]
  );

  const handleApply = useCallback(
    async (content: string, mode: "replace" | "insert", referenceText?: string) => {
      const latestSettings = await loadSettings();
      let refText = referenceText?.trim() || "";
      if (!refText) {
        const selectionSnapshot = await readCurrentSelection();
        refText = selectionSnapshot.text;
      }
      const cleanedContent = prepareTextForWordDocument(content, refText);

      if (mode === "replace") {
        if (!hasTrackedRange()) {
          const captured = await captureSelection();
          if (!captured.success) {
            showToast("请重新选中要替换的文本");
            return;
          }
          if (!refText) refText = captured.text;
        }

        const result = await applyText(cleanedContent);
        if (result.success) {
          showToast("已替换选中文本");
          clearTrackedRange();
        } else {
          showToast(result.error || "替换失败");
        }
        return;
      }

      await captureCursor();

      const applyOptions = {
        firstLineIndentChars: getInsertFirstLineIndentChars(latestSettings, false),
      };

      const result = await applyText(cleanedContent, applyOptions);
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

  const handleOutputStyleChange = useCallback(
    async (styleId: OutputStyleId) => {
      const nextSettings = { ...settings, outputStyleId: styleId };
      setSettings(nextSettings);
      try {
        await saveSettings(nextSettings);
        if (isOutputStyleActive(styleId)) {
          showToast(`输出风格：${getOutputStyleDisplay(styleId).label}`);
        } else {
          showToast("已恢复默认输出");
        }
      } catch (err) {
        showToast(localizeErrorMessage(err, "设置保存失败"));
      }
    },
    [settings, showToast]
  );

  const handleReorderBottomActions = useCallback(
    async (order: ChatBottomActionId[]) => {
      const nextSettings = { ...settings, chatBottomActionOrder: order };
      setSettings(nextSettings);
      try {
        await saveSettings(nextSettings);
      } catch (err) {
        showToast(localizeErrorMessage(err, "设置保存失败"));
      }
    },
    [settings, showToast]
  );

  const handleQuickApplyChange = useCallback(
    async (enabled: boolean) => {
      const nextSettings = { ...settings, quickApplyEnabled: enabled };
      setSettings(nextSettings);
      try {
        await saveSettings(nextSettings);
        showToast(enabled ? "快捷操作将直接写入文档" : "快捷操作将先预览再确认");
      } catch (err) {
        showToast(localizeErrorMessage(err, "设置保存失败"));
      }
    },
    [settings, showToast]
  );

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await saveSettings(newSettings);
      setSettings(newSettings);
      applyThemeColor(newSettings.themeColorId);
      setView("chat");
      showToast("设置已保存");
    } catch (err) {
      showToast(localizeErrorMessage(err, "设置保存失败"));
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
  }, [newConversation]);

  const handleExportSessions = useCallback(async () => {
    await exportSessions();
  }, [exportSessions]);

  const handleImportSessions = useCallback(
    async (file: File): Promise<string | null> => {
      const error = await importSessions(file);
      if (error) showToast(error);
      return error;
    },
    [importSessions, showToast]
  );

  const handleWelcomeCardClick = useCallback(
    async (cardId: string) => {
      if (cardId === "generate") {
        setInputDraft({
          text: "请根据以下主题生成文档内容：",
          focus: true,
          nonce: Date.now(),
        });
        showToast("请在输入框中补充写作主题");
        return;
      }

      if (cardId === "adjust") {
        if (selection.hasSelection) {
          const kind = detectSelectionContentKind(selection.text);
          const actionId: ActionType = kind === "code" ? "optimizeCode" : "polish";
          if (settings.quickApplyEnabled) {
            const error = await runDirectAction(actionId, selection.text);
            if (error) showToast(error);
            else showToast("已写入文档");
          } else {
            runAction(actionId, selection.text);
          }
          return;
        }

        setInputDraft({ text: "/润色 ", focus: true, nonce: Date.now() });
        showToast("请先在 Word 中选中文本，再使用润色、精简等操作");
        return;
      }

      if (cardId === "read") {
        if (selection.hasSelection) {
          if (settings.quickApplyEnabled) {
            const error = await runDirectAction("summarize", selection.text);
            if (error) showToast(error);
            else showToast("已写入文档");
          } else {
            runAction("summarize", selection.text);
          }
          return;
        }

        setInputDraft({
          text: "请快速总结这份文档的核心要点、结构与关键信息：",
          focus: true,
          nonce: Date.now(),
        });
        showToast("请先在 Word 中选中文本，或在输入框补充说明");
      }
    },
    [
      runAction,
      runDirectAction,
      selection.hasSelection,
      selection.text,
      settings.quickApplyEnabled,
      showToast,
    ]
  );

  const handleWritingProjectChange = useCallback(
    async (project: import("./types").WritingProject | null) => {
      await updateWritingProject(project);
    },
    [updateWritingProject]
  );

  const handleSettingsChange = useCallback(async (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    await saveSettings(nextSettings);
  }, []);

  return (
    <div className="app-container chat-layout">
      {showBrowserPreviewHint && (
        <div className="browser-preview-hint">
          浏览器预览模式：选区读写等 Word 功能不可用，请在 Word「开始 → AI编辑助手」中正式使用。
        </div>
      )}
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
          <div className="chat-view-header">
            <AppViewTabs view={view} disabled={loading} onChange={setView} />
          </div>

          {view === "writing" ? (
            <main className="writing-main">
              <WritingAssistantPanel
                settings={settings}
                project={writingProject}
                disabled={loading}
                initialTemplateId={writingTemplateId}
                onProjectChange={handleWritingProjectChange}
                onSettingsChange={handleSettingsChange}
                onNotify={showToast}
                onBusyChange={setWritingBusy}
              />
            </main>
          ) : view === "tools" ? (
            <main className="writing-main quick-commands-main">
              <QuickCommandsPanel
                hasSelection={selection.hasSelection}
                disabled={loading}
                onNotify={showToast}
              />
            </main>
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
                      quickApplyEnabled={!!settings.quickApplyEnabled}
                      onQuickApplyChange={handleQuickApplyChange}
                    />
                  </div>
                )}

                <ChatConversation
                  messages={messages}
                  loading={loading}
                  editingMessageId={editingMessageId}
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onApply={handleApply}
                  onRegenerate={regenerateMessage}
                  onStartEdit={startEditMessage}
                  onCancelEdit={cancelEditMessage}
                  onEditResend={handleEditResend}
                  onDelete={handleDeleteMessage}
                  onStop={stopGeneration}
                  onNotify={showToast}
                  onQuickAction={handleQuickAction}
                  hasSelection={selection.hasSelection}
                  selectionText={selection.text}
                  onWelcomeCardClick={handleWelcomeCardClick}
                  onNewChat={handleNewChat}
                  onSwitchSession={switchSession}
                  onRenameSession={renameSession}
                  onReorderSessions={reorderSessions}
                  onDeleteSession={deleteSession}
                  onExportSessions={handleExportSessions}
                  onImportSessions={handleImportSessions}
                />
              </div>

              {toast && <div className="chat-toast">{toast}</div>}

              <ChatInput
                settings={settings}
                hasSelection={selection.hasSelection}
                selectionText={selection.text}
                selectionCharCount={selection.charCount}
                disabled={loading}
                draft={inputDraft}
                onModelChange={handleModelChange}
                onOutputStyleChange={handleOutputStyleChange}
                onReorderBottomActions={handleReorderBottomActions}
                onSend={handleSend}
                onSlashAction={handleSlashAction}
                onOpenSettings={() => setView("settings")}
                onToggleWebSearch={handleToggleWebSearch}
                contextUsage={contextUsage}
                onError={showToast}
                onNotify={showToast}
              />
            </>
          )}

          {(view === "writing" || view === "tools") && toast && <div className="chat-toast">{toast}</div>}

          {view === "writing" && (
            <div className="writing-bottom-bar">
              <ChatInputBottomBar
                settings={settings}
                disabled={loading || writingBusy}
                contextUsage={contextUsage}
                onModelChange={handleModelChange}
                onOutputStyleChange={handleOutputStyleChange}
                onReorderBottomActions={handleReorderBottomActions}
                onToggleWebSearch={handleToggleWebSearch}
                onOpenSettings={() => setView("settings")}
              />
            </div>
          )}

          {view === "tools" && (
            <div className="writing-bottom-bar writing-bottom-bar--compact">
              <button type="button" className="icon-btn" title="设置" onClick={() => setView("settings")}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <circle cx="8" cy="3" r="1.2" />
                  <circle cx="8" cy="8" r="1.2" />
                  <circle cx="8" cy="13" r="1.2" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
