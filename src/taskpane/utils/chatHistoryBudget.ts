import { ChatMessage } from "../types";
import { getTextFromMessageContent } from "../services/multimodalService";

/** 历史消息 token 预算上限 */
export const DEFAULT_HISTORY_TOKEN_BUDGET = 200000;

/** 中英混合文本粗略换算：约 2 字符 ≈ 1 token */
export const CHARS_PER_TOKEN_ESTIMATE = 2;

/** 历史消息字符预算（与 token 预算对应） */
export const DEFAULT_HISTORY_CHAR_BUDGET =
  DEFAULT_HISTORY_TOKEN_BUDGET * CHARS_PER_TOKEN_ESTIMATE;

const IMAGE_CHAR_OVERHEAD = 2000;

export interface ContextUsageStats {
  budgetChars: number;
  budgetTokens: number;
  usedChars: number;
  usedTokens: number;
  percent: number;
  historyMessageCount: number;
  wouldTrim: boolean;
  trimmedChars: number;
}

export function charsToEstimatedTokens(chars: number): number {
  if (chars <= 0) return 0;
  return Math.ceil(chars / CHARS_PER_TOKEN_ESTIMATE);
}

export function createEmptyContextUsage(
  charBudget = DEFAULT_HISTORY_CHAR_BUDGET
): ContextUsageStats {
  const budgetTokens = charsToEstimatedTokens(charBudget);
  return {
    budgetChars: charBudget,
    budgetTokens,
    usedChars: 0,
    usedTokens: 0,
    percent: 0,
    historyMessageCount: 0,
    wouldTrim: false,
    trimmedChars: 0,
  };
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 10000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(tokens);
}

export function computeContextUsageStats(
  messages: ChatMessage[],
  charBudget = DEFAULT_HISTORY_CHAR_BUDGET
): ContextUsageStats {
  const budgetChars = charBudget;
  const budgetTokens = charsToEstimatedTokens(budgetChars);
  const { messages: trimmed, trimmedChars } = trimChatHistoryToBudget(messages, charBudget);
  const usedChars = estimateMessagesChars(trimmed);
  const usedTokens = charsToEstimatedTokens(usedChars);
  const rawChars = estimateMessagesChars(messages);
  const percent = budgetChars > 0 ? Math.round((usedChars / budgetChars) * 100) : 0;

  return {
    budgetChars,
    budgetTokens,
    usedChars,
    usedTokens,
    percent,
    historyMessageCount: trimmed.filter((message) => message.role !== "system").length,
    wouldTrim: trimmedChars > 0 || rawChars > usedChars,
    trimmedChars,
  };
}

export function estimateMessageChars(content: ChatMessage["content"]): number {
  const text = getTextFromMessageContent(content);
  if (typeof content === "string") {
    return text.length;
  }

  const imageCount = content.filter((part) => part.type === "image_url").length;
  return text.length + imageCount * IMAGE_CHAR_OVERHEAD;
}

export function estimateMessagesChars(messages: ChatMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageChars(message.content), 0);
}

export interface TrimHistoryResult {
  messages: ChatMessage[];
  trimmedTurns: number;
  trimmedChars: number;
}

/**
 * 保留 system 与最后一条 user 消息，从最早的历史开始裁剪直至满足字符预算。
 */
export function trimChatHistoryToBudget(
  messages: ChatMessage[],
  charBudget = DEFAULT_HISTORY_CHAR_BUDGET
): TrimHistoryResult {
  if (messages.length <= 1) {
    return { messages, trimmedTurns: 0, trimmedChars: 0 };
  }

  const systemMsg = messages[0]?.role === "system" ? messages[0] : null;
  const rest = systemMsg ? messages.slice(1) : messages;

  if (rest.length === 0) {
    return { messages, trimmedTurns: 0, trimmedChars: 0 };
  }

  const currentTurn = rest[rest.length - 1];
  const priorHistory = rest.slice(0, -1);

  const fixedChars =
    (systemMsg ? estimateMessageChars(systemMsg.content) : 0) +
    estimateMessageChars(currentTurn.content);

  let remaining = charBudget - fixedChars;
  if (remaining < 0) remaining = 0;

  const kept: ChatMessage[] = [];
  let trimStartIndex = -1;

  for (let i = priorHistory.length - 1; i >= 0; i--) {
    const chars = estimateMessageChars(priorHistory[i].content);
    if (chars <= remaining) {
      kept.unshift(priorHistory[i]);
      remaining -= chars;
    } else {
      trimStartIndex = i;
      break;
    }
  }

  let trimmedTurns = 0;
  let trimmedChars = 0;
  if (trimStartIndex >= 0) {
    const removed = priorHistory.slice(0, trimStartIndex + 1);
    trimmedTurns = removed.length;
    trimmedChars = removed.reduce((sum, message) => sum + estimateMessageChars(message.content), 0);
  }

  const result: ChatMessage[] = [];
  if (systemMsg) result.push(systemMsg);
  result.push(...kept, currentTurn);

  return { messages: result, trimmedTurns, trimmedChars };
}

export function formatHistoryTrimNotice(trimmedTurns: number, trimmedChars: number): string {
  const charsLabel =
    trimmedChars >= 1000 ? `${Math.round(trimmedChars / 1000)}k 字` : `${trimmedChars} 字`;
  return `对话历史过长，已省略最早 ${trimmedTurns} 条消息（约 ${charsLabel}）`;
}
