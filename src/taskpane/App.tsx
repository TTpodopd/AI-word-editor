import React, { useCallback, useEffect, useState } from "react";
import { ChatConversation } from "./components/ChatConversation";
import { ChatInput } from "./components/ChatInput";
import { SettingsPanel } from "./components/SettingsPanel";
import { SettingsHeader } from "./components/SettingsHeader";
import { SelectionBar } from "./components/SelectionBar";
import { AppViewTabs } from "./components/AppViewTabs";
import { DocumentToolsPanel } from "./components/DocumentToolsPanel";
import { WritingAssistantPanel } from "./components/WritingAssistantPanel";
import { useSelection } from "./hooks/useSelection";
import { useViewportScale } from "./hooks/useViewportScale";
import { useChat } from "./hooks/useChat";
import { ActionType, AppSettings, AppView, DEFAULT_SETTINGS, PendingAttachment } from "./types";
import { ensureOfficeReady, loadSettings, saveSettings, saveSelectedModel, saveWebSearchEnabled } from "./services/storageService";
import { ensureSelectedModelVisible } from "./services/modelService";
import { applyText, captureCursor, captureSelection, clearTrackedRange, hasTrackedRange, readCurrentSelection } from "./services/wordService";
import { applyFormFillContent, clearFormFillScope, resolveFormFillData } from "./services/formFillService";
import { getInsertFirstLineIndentChars, prepareTextForWordDocument } from "./utils/textFormat";
import { applyThemeColor } from "./utils/theme";
import { localizeErrorMessage } from "./utils/localizeErrorMessage";
import { detectSelectionContentKind } from "./utils/selectionContentType";

export function App() {
  const [view, setView] = useState<AppView>("chat");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toast, setToast] = useState("");
  const [writingTemplateId, setWritingTemplateId] = useState<string | undefined>(undefined);

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
    async (actionId: string) => {
      if (settings.quickApplyEnabled && actionId !== "fillForm") {
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
      if (actionId === "fillForm") {
        const error = await sendMessage("/填表", selection.hasSelection ? selection.text : undefined);
        if (error) showToast(error);
        return;
      }

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
    [runAction, runDirectAction, sendMessage, selection.hasSelection, selection.text, settings.quickApplyEnabled]
  );

  const handleApply = useCallback(
    async (
      content: string,
      mode: "replace" | "insert",
      formFill?: boolean,
      referenceText?: string
    ) => {
      if (formFill) {
        const result = await applyFormFillContent(content);
        if (result.success) {
          showToast(`已在选中区域填充 ${result.filledCount} 个字段`);
        } else {
          showToast(result.error || "填充失败");
        }
        return;
      }

      const skipFormFill =
        !!referenceText?.trim() && detectSelectionContentKind(referenceText) === "code";
      const formData = skipFormFill ? null : resolveFormFillData(content);
      if (formData) {
        const result = await applyFormFillContent(content);
        if (result.success) {
          showToast(`已在选中区域填充 ${result.filledCount} 个字段`);
        } else {
          showToast(result.error || "填充失败");
        }
        return;
      }

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
    clearFormFillScope();
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
    (cardId: string) => {
      if (cardId === "generate") {
        setWritingTemplateId("work-plan");
        setView("writing");
        showToast("已进入写作助手，请填写主题并生成大纲");
        return;
      }

      if (cardId === "adjust") {
        if (selection.hasSelection) {
          const kind = detectSelectionContentKind(selection.text);
          showToast(
            kind === "code"
              ? "已检测到代码选区，可使用顶部快捷按钮或 /优化、/注释、/删减 等指令"
              : "已检测到文本选区，可使用顶部快捷按钮或 /润色、/校对 等指令"
          );
        } else {
          showToast("请先在 Word 中选中文本，再使用润色、精简等操作");
        }
        return;
      }

      if (cardId === "read") {
        setWritingTemplateId("report");
        setView("writing");
        showToast("已进入写作助手，可使用「从 Word 文档续写」分析结构");
      }
    },
    [selection.hasSelection, selection.text, showToast]
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
              />
            </main>
          ) : view === "tools" ? (
            <main className="writing-main document-tools-main">
              <DocumentToolsPanel
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
                  onStop={stopGeneration}
                  onNotify={showToast}
                  onQuickAction={handleQuickAction}
                  hasSelection={selection.hasSelection}
                  selectionText={selection.text}
                  onWelcomeCardClick={handleWelcomeCardClick}
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
                onExportSessions={handleExportSessions}
                onImportSessions={handleImportSessions}
                contextUsage={contextUsage}
                onError={showToast}
                onNotify={showToast}
              />
            </>
          )}

          {(view === "writing" || view === "tools") && toast && <div className="chat-toast">{toast}</div>}

          {(view === "writing" || view === "tools") && (
            <div className="writing-bottom-bar">
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
