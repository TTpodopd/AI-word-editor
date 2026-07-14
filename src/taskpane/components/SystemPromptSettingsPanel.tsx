import React from "react";
import { DEFAULT_SYSTEM_PROMPTS, SystemPromptSettings } from "../types";

interface SystemPromptSettingsPanelProps {
  prompts: SystemPromptSettings;
  onChange: (prompts: SystemPromptSettings) => void;
}

export function SystemPromptSettingsPanel({ prompts, onChange }: SystemPromptSettingsPanelProps) {
  const updatePrompt = (key: keyof SystemPromptSettings, value: string) => {
    onChange({ ...prompts, [key]: value });
  };

  const resetPrompt = (key: keyof SystemPromptSettings) => {
    onChange({ ...prompts, [key]: DEFAULT_SYSTEM_PROMPTS[key] });
  };

  const resetAll = () => {
    onChange({ ...DEFAULT_SYSTEM_PROMPTS });
  };

  const isCustomized =
    prompts.withSelection.trim() !== DEFAULT_SYSTEM_PROMPTS.withSelection.trim() ||
    prompts.withoutSelection.trim() !== DEFAULT_SYSTEM_PROMPTS.withoutSelection.trim();

  return (
    <div className="system-prompt-settings">
      <div className="system-prompt-toolbar">
        <span className="settings-hint">自定义 AI 对话时的系统角色与行为规则。</span>
        {isCustomized && (
          <button type="button" className="link-btn" onClick={resetAll}>
            全部恢复默认
          </button>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-label-row">
          <label className="settings-label">选中文档时</label>
          <button type="button" className="link-btn" onClick={() => resetPrompt("withSelection")}>
            恢复默认
          </button>
        </div>
        <textarea
          className="settings-textarea"
          value={prompts.withSelection}
          onChange={(event) => updatePrompt("withSelection", event.target.value)}
          rows={5}
          placeholder="输入选中文档时使用的系统提示词"
        />
        <span className="settings-hint">用户选中 Word 文本后发送消息时生效。</span>
      </div>

      <div className="settings-group">
        <div className="settings-label-row">
          <label className="settings-label">未选中文档时</label>
          <button type="button" className="link-btn" onClick={() => resetPrompt("withoutSelection")}>
            恢复默认
          </button>
        </div>
        <textarea
          className="settings-textarea"
          value={prompts.withoutSelection}
          onChange={(event) => updatePrompt("withoutSelection", event.target.value)}
          rows={5}
          placeholder="输入未选中文档时使用的系统提示词"
        />
        <span className="settings-hint">自由对话、生成内容时使用。写入「首行缩进 N 字符」时，插入文档会自动应用段落格式。</span>
      </div>
    </div>
  );
}
