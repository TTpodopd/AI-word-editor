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
