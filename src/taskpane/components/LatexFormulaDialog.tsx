import React, { useEffect, useRef, useState } from "react";

interface LatexFormulaDialogProps {
  open: boolean;
  disabled?: boolean;
  initialLatex?: string;
  initialDisplayMode?: boolean;
  onClose: () => void;
  onConfirm: (latex: string, displayMode: boolean) => void | Promise<void>;
}

export function LatexFormulaDialog({
  open,
  disabled,
  initialLatex = "",
  initialDisplayMode = false,
  onClose,
  onConfirm,
}: LatexFormulaDialogProps) {
  const [latex, setLatex] = useState("");
  const [displayMode, setDisplayMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setLatex(initialLatex);
      setDisplayMode(initialDisplayMode);
      setSubmitting(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initialLatex, initialDisplayMode]);

  if (!open) return null;

  const handleConfirm = async () => {
    const trimmed = latex.trim();
    if (!trimmed || submitting || disabled) return;

    setSubmitting(true);
    try {
      await onConfirm(trimmed, displayMode);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleConfirm();
    }
  };

  return (
    <div className="latex-dialog-overlay" onClick={onClose}>
      <div
        className="latex-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="latex-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="latex-dialog-header">
          <h3 id="latex-dialog-title" className="latex-dialog-title">
            LaTeX 公式转换器
          </h3>
          <button
            type="button"
            className="latex-dialog-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <label className="latex-dialog-label" htmlFor="latex-formula-input">
          请粘贴 LaTeX 公式代码：
        </label>

        <textarea
          id="latex-formula-input"
          ref={inputRef}
          className="latex-dialog-input"
          value={latex}
          onChange={(event) => setLatex(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：\frac{a}{b} 或 E=mc^2"
          rows={4}
          disabled={disabled || submitting}
        />

        <label className="latex-dialog-checkbox">
          <input
            type="checkbox"
            checked={displayMode}
            onChange={(event) => setDisplayMode(event.target.checked)}
            disabled={disabled || submitting}
          />
          <span>块级公式（居中显示）</span>
        </label>

        <div className="latex-dialog-actions">
          <button
            type="button"
            className="btn-primary latex-dialog-confirm"
            onClick={() => void handleConfirm()}
            disabled={!latex.trim() || disabled || submitting}
          >
            {submitting ? "插入中…" : "确定"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
