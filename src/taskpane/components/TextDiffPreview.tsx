import React, { useMemo } from "react";
import { buildTextDiff, DiffSegment, getSegmentPlainText } from "../utils/textDiff";

interface TextDiffPreviewProps {
  original: string;
  revised: string;
  actionLabel?: string;
}

function renderRevisedSegments(segments: DiffSegment[]) {
  return segments.map((segment, index) => {
    if (segment.type === "equal") {
      return <span key={index}>{segment.text}</span>;
    }

    if (segment.type === "insert") {
      return (
        <span key={index} className="diff-mark diff-mark-insert">
          {segment.text}
        </span>
      );
    }

    return null;
  });
}

function renderRevisedBody(revised: string, diff: ReturnType<typeof buildTextDiff>) {
  if (!revised.trim()) {
    return <span className="text-diff-empty">未生成修改内容，请点击「重新生成」</span>;
  }

  if (!diff.hasChanges || diff.diffLimited) {
    return <span>{revised}</span>;
  }

  const highlighted = renderRevisedSegments(diff.revisedSegments);
  const segmentText = getSegmentPlainText(diff.revisedSegments);
  if (segmentText.length < revised.length) {
    return <span>{revised}</span>;
  }

  return highlighted;
}

export function TextDiffPreview({ original, revised, actionLabel }: TextDiffPreviewProps) {
  const diff = useMemo(() => buildTextDiff(original, revised), [original, revised]);

  return (
    <div className="text-diff-preview">
      <div className="text-diff-title">
        {actionLabel ? `【${actionLabel}预览】` : "【修改预览】"}
      </div>

      {diff.diffLimited && (
        <div className="text-diff-note">内容较长，以下为完整修改结果。</div>
      )}

      {!diff.diffLimited && !diff.hasChanges && revised.trim() && (
        <div className="text-diff-note">未发现需要修改的内容，确认后将保持原文不变。</div>
      )}

      <div className="text-diff-body text-diff-revised">
        {renderRevisedBody(revised, diff)}
      </div>

      {diff.hasChanges && !diff.diffLimited && (
        <div className="text-diff-legend">
          <span className="diff-legend-item">
            <span className="diff-mark diff-mark-insert">绿色高亮</span>
            表示修改或新增部分
          </span>
        </div>
      )}

      <div className="text-diff-hint">确认无误后点击「确定替换」，将替换文档中的选中内容。</div>
    </div>
  );
}
