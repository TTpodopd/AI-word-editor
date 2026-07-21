import React, { useEffect, useId, useRef, useState } from "react";
import {
  ContextUsageStats,
  formatContextUsagePercent,
  formatTokenCount,
} from "../utils/chatHistoryBudget";

interface ContextUsageIndicatorProps {
  usage: ContextUsageStats;
}

const RING_SIZE = 24;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatRingCenterPercent(percent: number): string {
  const label = formatContextUsagePercent(percent);
  if (label === "<0.1") return "<1%";
  return `${label}%`;
}

export function ContextUsageIndicator({ usage }: ContextUsageIndicatorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const level =
    usage.percent >= 95 ? "critical" : usage.percent >= 80 ? "warning" : "normal";
  const percentLabel = formatContextUsagePercent(usage.percent);
  const ringCenterLabel = formatRingCenterPercent(usage.percent);
  const ringProgress = usage.percent > 0 ? Math.max(usage.percent, 1.5) : 0;
  const ringOffset = RING_CIRCUMFERENCE - (Math.min(ringProgress, 100) / 100) * RING_CIRCUMFERENCE;

  const summary = `${formatTokenCount(usage.usedTokens)} / ${formatTokenCount(usage.budgetTokens)} tok · ${percentLabel}%`;
  const title = usage.wouldTrim
    ? `上下文 ${summary}，下次发送时将自动裁剪最早的历史`
    : `上下文 ${summary}`;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="context-usage-root" ref={rootRef}>
      <button
        type="button"
        className={`context-usage-trigger context-usage-trigger--${level}${open ? " is-open" : ""}`}
        title={title}
        aria-label={title}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="context-usage-ring-wrap" aria-hidden="true">
          <svg
            className="context-usage-ring"
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          >
            <circle
              className="context-usage-ring-track"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
            />
            <circle
              className="context-usage-ring-progress"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </svg>
          <span className="context-usage-ring-label">{ringCenterLabel}</span>
        </span>
      </button>

      {open && (
        <div className="context-usage-popover" id={popoverId} role="tooltip">
          <div className="context-usage-popover-title">上下文用量</div>
          <div className="context-usage-popover-value">
            {formatTokenCount(usage.usedTokens)} / {formatTokenCount(usage.budgetTokens)} tok
          </div>
          <div className="context-usage-popover-meta">
            <span>{percentLabel}%</span>
            {usage.historyMessageCount > 0 && (
              <span>{usage.historyMessageCount} 条历史消息</span>
            )}
          </div>
          {usage.wouldTrim && (
            <div className="context-usage-popover-note">
              下次发送时将自动裁剪最早的历史消息
            </div>
          )}
        </div>
      )}
    </div>
  );
}
