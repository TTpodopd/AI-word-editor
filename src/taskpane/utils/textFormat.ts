import type { AppSettings } from "../types";
import { getSystemPrompt } from "../types";

export function normalizeAssistantContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function extractAssistantResultText(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const fenced = trimmed.match(/^```(?:[\w-]+)?\s*\n?([\s\S]*?)```$/);
  if (fenced?.[1]) {
    return normalizeAssistantContent(fenced[1]);
  }

  return normalizeAssistantContent(trimmed);
}

function referenceContains(referenceText: string, pattern: RegExp): boolean {
  return pattern.test(referenceText);
}

const GREEK_LETTERS = "Α-Ωα-ω";
const VARIABLE_LETTER = `[A-Za-z${GREEK_LETTERS}]`;
const VARIABLE_TOKEN_START = new RegExp(
  `(?<![A-Za-z0-9${GREEK_LETTERS}])_(${VARIABLE_LETTER})(?=[\\-({\\d]|$)`,
  "gu"
);
const ORPHAN_TRAILING_EMPHASIS = /(?<=[\d)）])_(?=\s|$|[，。；：、])/g;
const ORPHAN_LEADING_ASTERISK = new RegExp(
  `(?<![A-Za-z0-9*${GREEK_LETTERS}])\\*(${VARIABLE_LETTER})(?=[\\-({\\d]|$)`,
  "gu"
);

/** AI 常输出未闭合的 _z-i、_ρ-i 等 Markdown 斜体，写入 Word 前去掉多余标记。 */
function stripOrphanMarkdownEmphasis(text: string, referenceText: string): string {
  const ref = referenceText.trim();
  if (
    referenceContains(ref, VARIABLE_TOKEN_START) ||
    referenceContains(ref, ORPHAN_LEADING_ASTERISK)
  ) {
    return text;
  }

  let result = text.replace(VARIABLE_TOKEN_START, "$1");
  result = result.replace(ORPHAN_LEADING_ASTERISK, "$1");
  result = result.replace(ORPHAN_TRAILING_EMPHASIS, "");
  return result;
}

/**
 * 根据 Word 原文风格，去除 AI 输出中多余的 Markdown / 标记符号。
 * referenceText 为空时，按纯文本 Word 文档默认清理常见标记。
 */
export function sanitizeTextForWord(text: string, referenceText = ""): string {
  if (!text) return "";

  let result = text;
  const ref = referenceText.trim();

  const stripBold = !referenceContains(ref, /\*\*[^*\n]+\*\*/);
  const stripUnderscoreBold = !referenceContains(ref, /__[^_\n]+__/);
  const stripItalic =
    !referenceContains(ref, /(?<![*\w])\*[^*\n]+\*(?![*\w])/) &&
    !referenceContains(ref, /(?<![_\w])_[^_\n]+_(?![_\w])/);
  const stripHeadings = !referenceContains(ref, /^#{1,6}\s/m);
  const stripChineseBrackets = !referenceContains(ref, /【[^】\n]+】/);
  const stripCornerBrackets = !referenceContains(ref, /「[^」\n]+」/);
  const stripBackticks = !referenceContains(ref, /`[^`\n]+`/);
  const stripMdLinks = !referenceContains(ref, /\[[^\]]+\]\([^)]+\)/);
  const stripBlockquote = !referenceContains(ref, /^>\s/m);
  const stripUnorderedList =
    referenceContains(ref, /^\d+[.、．]\s/m) && !referenceContains(ref, /^[-*+]\s/m);

  result = result.replace(/^```[\w-]*\n?([\s\S]*?)```$/gm, "$1");

  if (stripHeadings) {
    result = result.replace(/^#{1,6}\s+/gm, "");
  }

  if (stripBold) {
    result = result.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  }

  if (stripUnderscoreBold) {
    result = result.replace(/__([^_\n]+)__/g, "$1");
  }

  if (stripItalic) {
    result = result.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "$1");
    result = result.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, "$1");
  }

  if (stripChineseBrackets) {
    result = result.replace(/【([^】\n]*)】/g, "$1");
  }

  if (stripCornerBrackets) {
    result = result.replace(/「([^」\n]*)」/g, "$1");
  }

  if (stripBackticks) {
    result = result.replace(/`([^`\n]+)`/g, "$1");
  }

  if (stripMdLinks) {
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  }

  if (stripBlockquote) {
    result = result.replace(/^>\s?/gm, "");
  }

  if (stripUnorderedList) {
    result = result.replace(/^[-*+]\s+/gm, "");
  }

  if (stripBold) {
    result = result.replace(/\*\*/g, "");
  }

  result = result.replace(/^-{3,}$/gm, "");
  result = result.replace(/^\*{3,}$/gm, "");

  result = stripOrphanMarkdownEmphasis(result, ref);

  return normalizeAssistantContent(result);
}

/** 提取 AI 结果并清理为适合写入 Word 的纯文本 */
export function prepareTextForWordDocument(content: string, referenceText = ""): string {
  return sanitizeTextForWord(extractAssistantResultText(content), referenceText);
}

/** 从系统提示词解析「首行缩进 N 字符」规则，未配置时返回 0 */
export function parseFirstLineIndentChars(systemPrompt: string): number {
  const match = systemPrompt.match(/首行缩进\s*(\d+)\s*字符/);
  if (!match) return 0;
  const chars = Number.parseInt(match[1], 10);
  return Number.isFinite(chars) && chars > 0 ? chars : 0;
}

export function getInsertFirstLineIndentChars(settings: AppSettings, hasSelection: boolean): number {
  return parseFirstLineIndentChars(getSystemPrompt(settings, hasSelection));
}
