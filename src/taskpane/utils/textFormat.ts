import type { AppSettings } from "../types";
import { getSystemPrompt } from "../types";

export function normalizeAssistantContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 去除 AI 输出中不适合写入 Word 的乱码与控制字符 */
export function stripGarbledSymbols(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, "")
    .replace(/[\u2600-\u26FF\u2700-\u27BF]/g, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/(?<![*_])\*(?![*_])/g, "")
    .replace(/(?<![_])_(?![_])/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

/** 判断是否为无意义空行或 Markdown 残留行 */
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^[*_+#\-~`>|\\]+$/.test(trimmed)) return true;
  if (/^[-*+•·●○◆◇▪▫]\s*$/.test(trimmed)) return true;
  return false;
}

/** 写作助手专用：清理单节正文，去除乱码与空行 */
export function normalizeWritingSectionText(content: string, referenceText = ""): string {
  const sanitized = stripGarbledSymbols(sanitizeTextForWord(extractAssistantResultText(content), referenceText));
  return sanitized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !isNoiseLine(line))
    .join("\n")
    .trim();
}

/** 合并多节正文为连贯文档，节间仅保留单个换行 */
export function mergeWritingSectionTexts(parts: string[]): string {
  return parts
    .map((part) => normalizeWritingSectionText(part))
    .filter(Boolean)
    .join("\n");
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

  if (stripItalic) {
    result = result.replace(/(?<![*\w])\*(?![*\w])/g, "");
    result = result.replace(/(?<![_\w])_(?![_\w])/g, "");
  }

  result = result.replace(/^-{3,}$/gm, "");
  result = result.replace(/^\*{3,}$/gm, "");
  result = result.replace(/^_{3,}$/gm, "");

  result = stripOrphanMarkdownEmphasis(result, ref);
  result = stripGarbledSymbols(result);

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

/** 公文正文默认首行缩进 2 字符（GB/T 9704-2012） */
export const OFFICIAL_DOCUMENT_FIRST_LINE_INDENT = 2;

/** 写作助手插入 Word 的字体与字号预设 */
export const WRITING_FONT_NAME = "宋体";
export const WRITING_TITLE_FONT_SIZE = 14;
export const WRITING_BODY_FONT_SIZE = 12;

/** 写作助手默认 1.5 倍行距（Word OOXML：360 = 1.5 × 240） */
export const WRITING_LINE_SPACING = {
  line: 360,
  rule: "auto" as const,
};

/** 结构层次行：一、（一）1. 附件：特此… 等不缩进 */
const STRUCTURAL_LINE_PATTERN =
  /^([一二三四五六七八九十百]+[、．.]|[（(][一二三四五六七八九十\d]+[）)]|\d+[、．.]|[（(]\d+[）)]|附件[:：]|特此)/;

export function isWritingStructuralHeading(text: string): boolean {
  return STRUCTURAL_LINE_PATTERN.test(text.trim());
}

export function shouldIndentWritingParagraph(text: string, formatMode: "standard" | "official-document"): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (STRUCTURAL_LINE_PATTERN.test(trimmed)) return false;
  if (formatMode === "official-document" && trimmed.length < 8) return false;
  if (formatMode === "standard" && trimmed.length < 20) return false;
  return true;
}

export function shouldCenterWritingParagraph(
  text: string,
  index: number,
  formatMode: "standard" | "official-document"
): boolean {
  if (formatMode !== "official-document") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const officialDocTitle =
    /的(决议|决定|公告|通告|意见|通知|报告|请示|批复|函|纪要)$/.test(trimmed) ||
    /^(决议|决定|公告|通告|意见|通知|报告|请示|批复|函|纪要)$/.test(trimmed);

  if (index === 0 && officialDocTitle) return true;

  if (index <= 2 && /^\(.+\)$/.test(trimmed) && trimmed.length <= 48) return true;

  if (index > 1) return false;
  if (STRUCTURAL_LINE_PATTERN.test(trimmed)) return false;
  if (trimmed.length > 48) return false;
  if (/[:：]/.test(trimmed) && trimmed.length > 24) return false;
  return index === 1;
}

export function shouldRightAlignWritingParagraph(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(trimmed)) return true;
  if (/＋.*年月日.*＋/.test(trimmed)) return true;
  if (/＋.*[机关单位局处部厅委办公司中心]/.test(trimmed) && trimmed.length <= 28) return true;
  return false;
}
