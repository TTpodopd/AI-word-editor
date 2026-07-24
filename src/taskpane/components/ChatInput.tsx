import React, { useEffect, useMemo, useRef, useState } from "react";

import { AppSettings } from "../types";
import { ChatBottomActionId } from "../constants/chatBottomActions";
import { OutputStyleId } from "../prompts/outputStylePresets";
import { ContextUsageStats } from "../utils/chatHistoryBudget";

import { ACTION_PROMPTS, getActionBySlashCommand, getActionsForSelection } from "../prompts/actions";

import { ChatInputBottomBar } from "./ChatInputBottomBar";

import { ChatTextarea, ChatTextareaHandle, ChatTextareaListeners } from "./ChatTextarea";
import { LatexFormulaDialog } from "./LatexFormulaDialog";
import { SelectionQuoteStrip } from "./SelectionQuoteStrip";
import { useResizableInputHeight } from "../hooks/useResizableInputHeight";
import { insertLatexFormula, captureSelection, clearTrackedRange } from "../services/wordService";
import { extractLatexPreset, looksLikeLatex } from "../utils/latexOoxml";
import { runDocumentTool } from "../services/documentToolsService";

export interface ChatInputDraft {
  text: string;
  focus?: boolean;
  nonce: number;
}

interface ChatInputProps {
  settings: AppSettings;
  hasSelection: boolean;
  selectionText: string;
  selectionCharCount: number;

  disabled: boolean;
  draft?: ChatInputDraft | null;

  onModelChange: (modelId: string) => void;

  onOutputStyleChange: (styleId: OutputStyleId) => void;

  onReorderBottomActions: (order: ChatBottomActionId[]) => void;

  onSend: (message: string) => void | Promise<string | null>;

  onSlashAction: (actionId: string) => void;

  onOpenSettings: () => void;

  onToggleWebSearch: () => void;

  contextUsage: ContextUsageStats;

  onError?: (message: string) => void;
  onNotify?: (message: string) => void;
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

export function ChatInput({
  settings,
  hasSelection,
  selectionText,
  selectionCharCount,
  disabled,
  draft,
  onModelChange,
  onOutputStyleChange,
  onReorderBottomActions,
  onSend,
  onSlashAction,
  onOpenSettings,
  onToggleWebSearch,
  contextUsage,
  onError,
  onNotify,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [latexDialogOpen, setLatexDialogOpen] = useState(false);
  const [latexDialogPreset, setLatexDialogPreset] = useState({ latex: "", displayMode: false });
  const [latexReplaceMode, setLatexReplaceMode] = useState(false);
  const [formattingAcademicVariables, setFormattingAcademicVariables] = useState(false);
  const textareaRef = useRef<ChatTextareaHandle>(null);
  const textareaListenersRef = useRef<ChatTextareaListeners>({
    onValueChange: () => undefined,
    onEnter: () => undefined,
  });
  const sendingRef = useRef(false);
  const { height: inputHeight, resizing, handleResizeStart } = useResizableInputHeight();

  useEffect(() => {
    if (!draft) return;
    textareaRef.current?.setValue(draft.text);
    if (draft.focus) {
      requestAnimationFrame(() => {
        textareaRef.current?.focusEnd();
      });
    }
  }, [draft?.nonce]);

  const showSlashMenu = input.startsWith("/");

  const placeholder = hasSelection
    ? "基于引用内容输入指令，或 '/' 唤起对应快捷指令…"
    : "输入提示词开始对话，或 '/' 唤起指令…";

  const availableActions = useMemo(
    () => getActionsForSelection(selectionText, hasSelection),
    [hasSelection, selectionText]
  );

  const canSend = input.trim().length > 0 && !disabled;

  const notifyError = (message: string) => {
    if (onError) onError(message);
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
    const trimmed = (textareaRef.current?.getValue() ?? input).trim();

    if (!canSend || sendingRef.current) return;

    sendingRef.current = true;
    try {
      const matchedAction = getActionBySlashCommand(trimmed, selectionText, hasSelection);

      if (matchedAction) {
        if (hasSelection) {
          onSlashAction(matchedAction.id);
        } else {
          const error = await onSend(`请${matchedAction.label}一段适合放入 Word 文档的内容`);
          if (error) notifyError(error);
        }
      } else {
        const error = await onSend(trimmed);
        if (error) notifyError(error);
      }

      setInput("");
      textareaRef.current?.clear();
    } finally {
      sendingRef.current = false;
    }
  };

  const handleTextareaValueChange = (value: string) => {
    setInput(value);
  };

  textareaListenersRef.current.onValueChange = handleTextareaValueChange;
  textareaListenersRef.current.onEnter = () => {
    void handleSend();
  };

  const handleSlashSelect = (actionId: string) => {
    if (hasSelection) {
      onSlashAction(actionId);
    } else {
      const action = ACTION_PROMPTS.find((a) => a.id === actionId);
      if (action) void onSend(`请${action.label}一段适合放入 Word 文档的内容`);
    }

    setInput("");
    textareaRef.current?.clear();
  };

  const filteredActions = availableActions.filter(
    (a) => input === "/" || a.slashCommand.startsWith(input)
  );

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

        {hasSelection && selectionText && (
          <SelectionQuoteStrip text={selectionText} charCount={selectionCharCount} />
        )}
        <ChatTextarea
          ref={textareaRef}
          disabled={disabled}
          placeholder={placeholder}
          height={inputHeight}
          listenersRef={textareaListenersRef}
        />

        <div className="chat-input-footer">
          <button
            type="button"
            className="upload-btn"
            onClick={() => void handleOpenLatexDialog()}
            disabled={disabled}
            title="插入 LaTeX 公式"
          >
            <FormulaIcon />
          </button>
          <button
            type="button"
            className="upload-btn"
            onClick={() => void handleFormatAcademicVariables()}
            disabled={disabled || formattingAcademicVariables || !hasSelection}
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
        disabled={disabled}
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

      <ChatInputBottomBar
        settings={settings}
        disabled={disabled}
        contextUsage={contextUsage}
        onModelChange={onModelChange}
        onOutputStyleChange={onOutputStyleChange}
        onReorderBottomActions={onReorderBottomActions}
        onToggleWebSearch={onToggleWebSearch}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
