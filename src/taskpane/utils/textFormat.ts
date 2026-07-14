import type { AppSettings } from "../types";
import { getSystemPrompt } from "../types";

export function normalizeAssistantContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
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
