import React, { useRef, useState } from "react";
import { AppSettings, WritingTemplate } from "../types";
import { getAllWritingTemplates } from "../prompts/writing/templates";
import {
  addCustomWritingTemplate,
  downloadWritingTemplate,
  importWritingTemplateFromFile,
  removeWritingTemplate,
  restoreHiddenWritingTemplates,
} from "../services/writingTemplateStorage";

interface WritingTemplateManagerProps {
  settings: AppSettings;
  disabled?: boolean;
  onSettingsChange: (settings: AppSettings) => void;
  onNotify: (text: string) => void;
}

export function WritingTemplateManager({
  settings,
  disabled,
  onSettingsChange,
  onNotify,
}: WritingTemplateManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templates = getAllWritingTemplates(settings);
  const customTemplates = templates.filter((item) => !item.builtin);
  const hiddenBuiltinCount = settings.hiddenWritingTemplateIds?.length ?? 0;

  const handleImport = async (file: File) => {
    try {
      const template = await importWritingTemplateFromFile(file);
      const nextSettings = await addCustomWritingTemplate(template);
      onSettingsChange(nextSettings);
      onNotify(`已导入模板「${template.name}」`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "导入失败");
    }
  };

  const handleDelete = async (template: WritingTemplate) => {
    const nextSettings = await removeWritingTemplate(template);
    onSettingsChange(nextSettings);
    onNotify(`已删除模板「${template.name}」`);
  };

  const handleRestoreBuiltin = async () => {
    const nextSettings = await restoreHiddenWritingTemplates();
    onSettingsChange(nextSettings);
    onNotify("已恢复全部内置模板");
  };

  return (
    <div className="writing-template-manager">
      <button
        type="button"
        className="writing-template-toggle"
        onClick={() => setExpanded((value) => !value)}
        disabled={disabled}
      >
        自定义模板 ({customTemplates.length})
        <span>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="writing-template-panel">
          <div className="writing-template-actions">
            <button
              type="button"
              className="writing-secondary-btn"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
            >
              导入 JSON
            </button>
            {hiddenBuiltinCount > 0 && (
              <button
                type="button"
                className="writing-ghost-btn"
                disabled={disabled}
                onClick={() => void handleRestoreBuiltin()}
              >
                恢复内置模板 ({hiddenBuiltinCount})
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.target.value = "";
              }}
            />
          </div>

          {customTemplates.length === 0 ? (
            <p className="writing-template-empty">暂无自定义模板，可导入 JSON 或从大纲保存。</p>
          ) : (
            <ul className="writing-template-list">
              {customTemplates.map((template) => (
                <li key={template.id} className="writing-template-item">
                  <div>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </div>
                  <div className="writing-template-item-actions">
                    <button
                      type="button"
                      className="writing-link-btn"
                      disabled={disabled}
                      onClick={() => downloadWritingTemplate(template)}
                    >
                      导出
                    </button>
                    <button
                      type="button"
                      className="writing-link-btn danger"
                      disabled={disabled}
                      onClick={() => void handleDelete(template)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export async function saveOutlineAsTemplate(
  name: string,
  description: string,
  outline: import("../types").WritingOutlineSection[],
  systemPrompt: string,
  sectionRules: string,
  onSettingsChange: (settings: AppSettings) => void,
  onNotify: (text: string) => void
): Promise<void> {
  const template: WritingTemplate = {
    id: `custom-${Date.now()}`,
    name: name.trim() || "自定义模板",
    description: description.trim(),
    builtin: false,
    outlineSkeleton: outline.map((section) => ({
      level: section.level,
      title: section.title,
      brief: section.brief,
    })),
    systemPrompt: systemPrompt.trim() || "你是一位专业的文档写作助手。",
    sectionRules: sectionRules.trim() || "直接输出正文，不要 Markdown 标记。",
  };

  const nextSettings = await addCustomWritingTemplate(template);
  onSettingsChange(nextSettings);
  onNotify(`已保存模板「${template.name}」`);
}
