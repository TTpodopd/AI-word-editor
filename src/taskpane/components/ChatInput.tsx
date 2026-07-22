import React, { useMemo, useRef, useState } from "react";

import { AppSettings, ChatSession, PendingAttachment } from "../types";
import { ContextUsageStats } from "../utils/chatHistoryBudget";
import { ContextUsageIndicator } from "./ContextUsageIndicator";

import { getVisibleModels, resolveModel } from "../services/modelService";

import { ACTION_PROMPTS, getActionBySlashCommand, getActionsForSelection } from "../prompts/actions";

import { ChatBottomActions } from "./ChatBottomActions";

import { ModelSelector } from "./ModelSelector";

import { AttachmentStrip } from "./AttachmentStrip";
import { LatexFormulaDialog } from "./LatexFormulaDialog";
import { SelectionQuoteStrip } from "./SelectionQuoteStrip";
import { useResizableInputHeight } from "../hooks/useResizableInputHeight";
import {
  ACCEPTED_UPLOAD_TYPES,
  createAttachmentFromFile,
  createDocumentAttachmentFromText,
} from "../services/attachmentService";
import { insertLatexFormula, captureSelection, clearTrackedRange, readDocumentTextForAttachment } from "../services/wordService";
import { extractLatexPreset, looksLikeLatex } from "../utils/latexOoxml";
import { runDocumentTool } from "../services/documentToolsService";



import { hasImageAttachments, modelSupportsVision } from "../constants/modelCapabilities";

interface ChatInputProps {
  settings: AppSettings;
  hasSelection: boolean;
  selectionText: string;
  selectionCharCount: number;

  disabled: boolean;

  sessions: ChatSession[];

  activeSessionId: string | null;

  onModelChange: (modelId: string) => void;

  onSend: (message: string, attachments?: PendingAttachment[]) => void | Promise<string | null>;

  onSlashAction: (actionId: string) => void;

  onNewChat: () => void;

  onOpenSettings: () => void;

  onToggleWebSearch: () => void;

  onSwitchSession: (sessionId: string) => void;

  onRenameSession: (sessionId: string, title: string) => void;

  onReorderSessions: (orderedIds: string[]) => void;

  onDeleteSession: (sessionId: string) => void;

  onExportSessions?: () => void | Promise<void>;
  onImportSessions?: (file: File) => void | Promise<string | null>;

  contextUsage: ContextUsageStats;

  onError?: (message: string) => void;
  onNotify?: (message: string) => void;

}



function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 2l4 4h-3v5H7V6H4l4-4zm-6 10h12v1H2v-1z" />
    </svg>
  );
}

function FormulaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 14h2l1.2-3H10l1 3h2L9.2 2H7L3 14zm4.2-5L8.4 5.6 9.6 9H7.2zM11.5 2v2h2V2h-2zm0 3v2h2V5h-2zm0 3v2h2V8h-2z" />
    </svg>
  );
}

function AcademicVariableIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.2 3h6.1M7.8 3L5.5 11.2c-.25.9-.7 1.35-1.45 1.35-.4 0-.75-.12-1.05-.35"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 9.2h2.15l-2.7 3.3h2.45"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 4h10v1H3V4zm0 3.5h10v1H3v-1zm0 3.5h7v1H3v-1z" />
    </svg>
  );
}

export function ChatInput({
  settings,
  hasSelection,
  selectionText,
  selectionCharCount,

  disabled,

  sessions,

  activeSessionId,

  onModelChange,

  onSend,

  onSlashAction,

  onNewChat,

  onOpenSettings,

  onToggleWebSearch,

  onSwitchSession,

  onRenameSession,

  onReorderSessions,

  onDeleteSession,

  onExportSessions,
  onImportSessions,

  contextUsage,

  onError,
  onNotify,
}: ChatInputProps) {

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [latexDialogOpen, setLatexDialogOpen] = useState(false);
  const [latexDialogPreset, setLatexDialogPreset] = useState({ latex: "", displayMode: false });
  const [latexReplaceMode, setLatexReplaceMode] = useState(false);
  const [formattingAcademicVariables, setFormattingAcademicVariables] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const sendingRef = useRef(false);
  const { height: inputHeight, resizing, handleResizeStart } = useResizableInputHeight();

  const showSlashMenu = input.startsWith("/");

  const getTextareaValue = () => textareaRef.current?.value ?? input;



  const placeholder = hasSelection
    ? "基于引用内容输入指令，或 '/' 唤起对应快捷指令…"
    : "输入提示词开始对话，或 '/' 唤起指令…";

  const availableActions = useMemo(
    () => getActionsForSelection(selectionText, hasSelection),
    [hasSelection, selectionText]
  );



  const canSend = (getTextareaValue().trim().length > 0 || attachments.length > 0) && !disabled && !uploading;



  const notifyError = (message: string) => {

    if (onError) onError(message);

  };



  const validateVisionModel = (nextAttachments: PendingAttachment[]): string | null => {

    if (!hasImageAttachments(nextAttachments)) return null;

    const model = resolveModel(settings, settings.selectedModelId);

    if (model && !modelSupportsVision(model)) {

      return `当前模型（${model.label}）不支持图片分析，请切换到 GPT-4o 等视觉模型`;

    }

    return null;

  };



  const handleFilesSelected = async (files: FileList | null) => {

    if (!files?.length || disabled) return;



    setUploading(true);

    try {

      const next = [...attachments];

      for (const file of Array.from(files)) {

        const attachment = await createAttachmentFromFile(file);

        next.push(attachment);

      }



      const visionError = validateVisionModel(next);

      if (visionError) {

        notifyError(visionError);

        return;

      }



      setAttachments(next);

    } catch (error) {

      notifyError(error instanceof Error ? error.message : "文件上传失败");

    } finally {

      setUploading(false);

      if (fileInputRef.current) fileInputRef.current.value = "";

    }

  };



  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQuoteDocument = async () => {
    if (disabled || uploading) return;

    setUploading(true);
    try {
      const result = await readDocumentTextForAttachment();
      if (!result.success) {
        notifyError(result.error || "读取文档内容失败");
        return;
      }

      const attachment = await createDocumentAttachmentFromText(result.sourceName, result.text);
      const next = [...attachments, attachment];
      const visionError = validateVisionModel(next);
      if (visionError) {
        notifyError(visionError);
        return;
      }

      setAttachments(next);
      onNotify?.(`已引用${result.sourceName}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "引用文档失败");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenLatexDialog = async () => {
    const shouldReplace = hasSelection && looksLikeLatex(selectionText);
    const preset = shouldReplace
      ? extractLatexPreset(selectionText)
      : { latex: "", displayMode: false };

    if (shouldReplace) {
      const captured = await captureSelection();
      if (!captured.success) {
        notifyError("选区已失效，请重新选中文本后再试");
        return;
      }
      setLatexReplaceMode(true);
    } else {
      clearTrackedRange();
      setLatexReplaceMode(false);
    }

    setLatexDialogPreset(preset);
    setLatexDialogOpen(true);
  };

  const handleLatexConfirm = async (latex: string, displayMode: boolean) => {
    const result = await insertLatexFormula(latex, displayMode);
    if (result.success) {
      setLatexDialogOpen(false);
      setLatexReplaceMode(false);
      if (onNotify) {
        onNotify(latexReplaceMode ? "公式已替换选中文本" : "公式已插入到文档");
      }
    } else {
      notifyError(result.error || "插入公式失败");
    }
  };

  const handleFormatAcademicVariables = async () => {
    if (!hasSelection) {
      notifyError("请先在 Word 中选中包含变量字母的段落");
      return;
    }

    setFormattingAcademicVariables(true);
    try {
      const result = await runDocumentTool("format-academic-variables");
      if (result.success) {
        onNotify?.(result.message || "段落字母排版优化已完成");
      } else {
        notifyError(result.error || "段落字母排版优化失败");
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "段落字母排版优化失败");
    } finally {
      setFormattingAcademicVariables(false);
    }
  };

  const handleSend = async () => {
    const trimmed = getTextareaValue().trim();

    if (!canSend || sendingRef.current) return;

    const visionError = validateVisionModel(attachments);

    if (visionError) {
      notifyError(visionError);
      return;
    }

    sendingRef.current = true;
    try {
      const matchedAction = getActionBySlashCommand(trimmed, selectionText, hasSelection);

      if (matchedAction) {
        if (hasSelection) {
          onSlashAction(matchedAction.id);
        } else {
          const error = await onSend(`请${matchedAction.label}一段适合放入 Word 文档的内容`, attachments);
          if (error) notifyError(error);
        }
      } else {
        const error = await onSend(trimmed, attachments);
        if (error) notifyError(error);
      }

      setInput("");
      if (textareaRef.current) textareaRef.current.value = "";
      setAttachments([]);
    } finally {
      sendingRef.current = false;
    }
  };



  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229) {
        return;
      }
      e.preventDefault();
      void handleSend();
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    setInput(e.currentTarget.value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) return;
    setInput(e.target.value);
  };



  const handleSlashSelect = (actionId: string) => {
    if (hasSelection) {
      onSlashAction(actionId);
    } else {

      const action = ACTION_PROMPTS.find((a) => a.id === actionId);

      if (action) void onSend(`请${action.label}一段适合放入 Word 文档的内容`, attachments);

    }

    setInput("");

    if (textareaRef.current) textareaRef.current.value = "";

    setAttachments([]);
  };



  const filteredActions = availableActions.filter(
    (a) => input === "/" || a.slashCommand.startsWith(input)
  );



  const modelOptions = getVisibleModels(settings);



  return (

    <div className={`chat-input-panel${resizing ? " is-resizing" : ""}`}>

      <div

        className="chat-input-resize-handle"

        role="separator"

        aria-orientation="horizontal"

        aria-label="拖动调整输入框高度"

        aria-valuemin={56}

        aria-valuemax={280}

        aria-valuenow={inputHeight}

        onPointerDown={handleResizeStart}

      />

      <div className="chat-input-area">

        {showSlashMenu && filteredActions.length > 0 && (

          <div className="slash-menu">

            {filteredActions.map((action) => (

              <div

                key={action.id}

                className="slash-menu-item"

                onClick={() => handleSlashSelect(action.id)}

              >

                <span>{action.slashCommand}</span>

                <span className="slash-label">{action.label}</span>

              </div>

            ))}

          </div>

        )}

        <AttachmentStrip
          attachments={attachments}
          disabled={disabled || uploading}
          onRemove={handleRemoveAttachment}
        />
        {hasSelection && selectionText && (
          <SelectionQuoteStrip text={selectionText} charCount={selectionCharCount} />
        )}
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={placeholder}
          defaultValue=""
          onChange={handleInputChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          disabled={disabled || uploading}
          style={{ height: inputHeight }}
        />

        <div className="chat-input-footer">

          <input

            ref={fileInputRef}

            type="file"

            className="attachment-file-input"

            accept={ACCEPTED_UPLOAD_TYPES}

            multiple

            onChange={(e) => void handleFilesSelected(e.target.files)}

          />

          <button

            type="button"

            className="upload-btn"

            onClick={() => fileInputRef.current?.click()}

            disabled={disabled || uploading}

            title="上传图片或文档"

          >

            <UploadIcon />
          </button>
          <button
            type="button"
            className="upload-btn"
            onClick={() => void handleQuoteDocument()}
            disabled={disabled || uploading}
            title="引用 Word 选区或全文"
          >
            <QuoteIcon />
          </button>
          <button
            type="button"
            className="upload-btn"
            onClick={() => void handleOpenLatexDialog()}
            disabled={disabled || uploading}
            title="插入 LaTeX 公式"
          >
            <FormulaIcon />
          </button>
          <button
            type="button"
            className="upload-btn"
            onClick={() => void handleFormatAcademicVariables()}
            disabled={disabled || uploading || formattingAcademicVariables || !hasSelection}
            title={
              hasSelection
                ? "优化选中段落的变量字母排版"
                : "请先选中包含变量字母的段落"
            }
          >
            <AcademicVariableIcon />
          </button>
          <button
            className="send-btn"

            onClick={() => void handleSend()}

            disabled={!canSend}

            title="发送"

          >

            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">

              <path d="M2 8l12-6-2.5 6 2.5 6z" />

            </svg>

          </button>

        </div>

      </div>

      <LatexFormulaDialog
        open={latexDialogOpen}
        disabled={disabled || uploading}
        initialLatex={latexDialogPreset.latex}
        initialDisplayMode={latexDialogPreset.displayMode}
        onClose={() => {
          setLatexDialogOpen(false);
          if (latexReplaceMode) {
            clearTrackedRange();
            setLatexReplaceMode(false);
          }
        }}
        onConfirm={handleLatexConfirm}
      />

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

    </div>

  );

}

