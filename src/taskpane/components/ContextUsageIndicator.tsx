import React from "react";
import { ContextUsageStats, formatTokenCount } from "../utils/chatHistoryBudget";

interface ContextUsageIndicatorProps {
  usage: ContextUsageStats;
}

export function ContextUsageIndicator({ usage }: ContextUsageIndicatorProps) {
  const level =
    usage.percent >= 95 ? "critical" : usage.percent >= 80 ? "warning" : "normal";

  const title = usage.wouldTrim
    ? `上下文约 ${formatTokenCount(usage.usedTokens)} / ${formatTokenCount(usage.budgetTokens)} tokens（${usage.percent}%），下次发送时将自动裁剪最早的历史`
    : `上下文约 ${formatTokenCount(usage.usedTokens)} / ${formatTokenCount(usage.budgetTokens)} tokens（${usage.percent}%）`;

  return (
    <div
      className={`context-usage-indicator context-usage-indicator--${level}`}
      title={title}
      aria-label={title}
    >
      <span className="context-usage-label">上下文</span>
      <span className="context-usage-value">
        {formatTokenCount(usage.usedTokens)} / {formatTokenCount(usage.budgetTokens)} tok
      </span>
      <span className="context-usage-percent">{usage.percent}%</span>
      <span className="context-usage-bar" aria-hidden="true">
        <span
          className="context-usage-bar-fill"
          style={{ width: `${Math.min(usage.percent, 100)}%` }}
        />
      </span>
    </div>
  );
}
