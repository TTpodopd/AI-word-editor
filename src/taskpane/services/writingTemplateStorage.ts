import { AppSettings, WritingTemplate } from "../types";
import { loadSettings, saveSettings } from "./storageService";
import { validateWritingTemplate } from "../prompts/writing/templates";

export async function loadCustomWritingTemplates(): Promise<WritingTemplate[]> {
  const settings = await loadSettings();
  return settings.customWritingTemplates || [];
}

export async function saveCustomWritingTemplates(templates: WritingTemplate[]): Promise<AppSettings> {
  const settings = await loadSettings();
  const nextSettings = {
    ...settings,
    customWritingTemplates: templates.filter((item) => !item.builtin),
  };
  await saveSettings(nextSettings);
  return nextSettings;
}

export async function addCustomWritingTemplate(template: WritingTemplate): Promise<AppSettings> {
  const existing = await loadCustomWritingTemplates();
  const filtered = existing.filter((item) => item.id !== template.id);
  return saveCustomWritingTemplates([...filtered, { ...template, builtin: false }]);
}

export async function removeCustomWritingTemplate(templateId: string): Promise<AppSettings> {
  const existing = await loadCustomWritingTemplates();
  return saveCustomWritingTemplates(existing.filter((item) => item.id !== templateId));
}

export async function removeWritingTemplate(template: WritingTemplate): Promise<AppSettings> {
  if (template.builtin) {
    const settings = await loadSettings();
    const hidden = new Set(settings.hiddenWritingTemplateIds || []);
    hidden.add(template.id);
    const nextSettings = {
      ...settings,
      hiddenWritingTemplateIds: [...hidden],
    };
    await saveSettings(nextSettings);
    return nextSettings;
  }

  return removeCustomWritingTemplate(template.id);
}

export async function restoreHiddenWritingTemplates(templateIds?: string[]): Promise<AppSettings> {
  const settings = await loadSettings();
  const hidden = settings.hiddenWritingTemplateIds || [];
  if (hidden.length === 0) {
    return settings;
  }

  const nextHidden = templateIds
    ? hidden.filter((id) => !templateIds.includes(id))
    : [];

  const nextSettings = {
    ...settings,
    hiddenWritingTemplateIds: nextHidden,
  };
  await saveSettings(nextSettings);
  return nextSettings;
}

export async function updateCustomWritingTemplate(template: WritingTemplate): Promise<AppSettings> {
  return addCustomWritingTemplate({ ...template, builtin: false });
}

export function createEmptyWritingTemplate(): WritingTemplate {
  return {
    id: `custom-${Date.now()}`,
    name: "新建模板",
    description: "",
    category: "custom",
    builtin: false,
    outlineSkeleton: [{ level: 1, title: "第一章", brief: "请填写本节写作要点" }],
    systemPrompt: "你是一位专业的文档写作助手。",
    sectionRules: "直接输出正文，不要 Markdown 标记。",
  };
}

export function downloadWritingTemplate(template: WritingTemplate, filename?: string): void {
  const payload = {
    version: 1,
    exportedAt: Date.now(),
    template: { ...template, builtin: false },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `${template.id}-template.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importWritingTemplateFromFile(file: File): Promise<WritingTemplate> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("模板文件不是有效的 JSON");
  }

  const payload = raw as { template?: unknown };
  const candidate = payload.template ?? raw;
  const validated = validateWritingTemplate(candidate);
  if (!validated) {
    throw new Error("模板格式无效，请检查 id、name 与 outlineSkeleton");
  }

  return validated;
}
