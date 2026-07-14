import React from "react";
import { AppSettings } from "../types";
import { getAvailableModels } from "../services/modelService";
import { ModelIcon } from "./ModelIcon";

interface ModelVisibilitySettingsProps {
  settings: AppSettings;
  onChange: (hiddenModelIds: string[]) => void;
}

const PROVIDER_GROUP_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
  qwen: "通义千问",
  custom: "自定义 API",
};

export function ModelVisibilitySettings({ settings, onChange }: ModelVisibilitySettingsProps) {
  const allModels = getAvailableModels(settings);
  const hiddenSet = new Set(settings.hiddenModelIds || []);
  const visibleCount = allModels.filter((item) => !hiddenSet.has(item.id)).length;

  const toggleModel = (modelId: string, visible: boolean) => {
    const next = new Set(hiddenSet);
    if (visible) {
      next.delete(modelId);
    } else if (visibleCount > 1) {
      next.add(modelId);
    }
    onChange(Array.from(next));
  };

  const setAllVisible = () => onChange([]);

  const grouped = allModels.reduce<Record<string, typeof allModels>>((acc, model) => {
    const groupKey =
      model.provider === "custom" && model.customProviderId
        ? `custom:${model.customProviderId}`
        : model.provider;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(model);
    return acc;
  }, {});

  const getGroupLabel = (groupKey: string) => {
    if (groupKey.startsWith("custom:")) {
      const providerId = groupKey.slice("custom:".length);
      const provider = settings.customProviders.find((item) => item.id === providerId);
      return provider?.name?.trim() || "自定义 API";
    }
    return PROVIDER_GROUP_LABELS[groupKey] || groupKey;
  };

  if (allModels.length === 0) {
    return (
      <div className="model-visibility-empty">暂无可配置的模型，请先添加 API 或自定义分组。</div>
    );
  }

  return (
    <div className="model-visibility-settings">
      <div className="model-visibility-toolbar">
        <span className="model-visibility-count">
          已显示 {visibleCount} / {allModels.length} 个模型
        </span>
        {hiddenSet.size > 0 && (
          <button type="button" className="link-btn" onClick={setAllVisible}>
            全部显示
          </button>
        )}
      </div>

      {Object.entries(grouped).map(([groupKey, models]) => (
        <div key={groupKey} className="model-visibility-group">
          <div className="model-visibility-group-title">{getGroupLabel(groupKey)}</div>
          <div className="model-visibility-list">
            {models.map((model) => {
              const visible = !hiddenSet.has(model.id);
              const disableHide = visible && visibleCount <= 1;

              return (
                <label
                  key={model.id}
                  className={`model-visibility-item${visible ? "" : " hidden-item"}`}
                  title={disableHide ? "至少保留一个可见模型" : undefined}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    disabled={disableHide}
                    onChange={(e) => toggleModel(model.id, e.target.checked)}
                  />
                  <ModelIcon model={model} size={18} />
                  <span className="model-visibility-label">{model.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
