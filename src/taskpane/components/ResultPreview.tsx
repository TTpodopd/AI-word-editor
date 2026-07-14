import React from "react";
import { ApplyMode } from "../services/wordService";

interface ResultPreviewProps {
  result: string;
  error: string;
  loading: boolean;
  applyMode: ApplyMode;
  onApply: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
  applying: boolean;
}

export function ResultPreview({
  result,
  error,
  loading,
  applyMode,
  onApply,
  onDiscard,
  onRegenerate,
  applying,
}: ResultPreviewProps) {
  const applyLabel = "插入到文档";

  if (loading) {
    return (
      <div className="result-preview">
        <div className="loading-indicator">
          <div className="spinner" />
          AI 正在处理中…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="result-preview">
        <div className="error-message">{error}</div>
        <div className="result-actions">
          <button className="btn-secondary" onClick={onDiscard}>
            关闭
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="result-preview">
      <div className="result-header">AI 处理结果</div>
      <div className="result-content">{result}</div>
      <div className="result-actions">
        <button className="btn-primary" onClick={onApply} disabled={applying}>
          {applying ? "写入中…" : applyLabel}
        </button>
        <button className="btn-secondary" onClick={onRegenerate} disabled={applying}>
          重新生成
        </button>
        <button className="btn-secondary" onClick={onDiscard} disabled={applying}>
          放弃
        </button>
      </div>
    </div>
  );
}
