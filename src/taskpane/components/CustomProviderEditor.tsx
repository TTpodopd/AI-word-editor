import React from "react";
import { CustomProvider } from "../types";
import { createModelId, normalizeApiBaseUrl } from "../services/modelService";

interface CustomProviderEditorProps {
  provider: CustomProvider;
  onChange: (provider: CustomProvider) => void;
  onRemove: () => void;
  onTest: () => void;
  testing: boolean;
  testResult?: { ok: boolean; error?: string };
}

export function CustomProviderEditor({
  provider,
  onChange,
  onRemove,
  onTest,
  testing,
  testResult,
}: CustomProviderEditorProps) {
  const update = (patch: Partial<CustomProvider>) => onChange({ ...provider, ...patch });

  const updateModel = (modelId: string, patch: { modelId?: string; nickname?: string }) => {
    onChange({
      ...provider,
      models: provider.models.map((m) => (m.id === modelId ? { ...m, ...patch } : m)),
    });
  };

  const addModel = () => {
    onChange({
      ...provider,
      models: [...provider.models, { id: createModelId(), modelId: "", nickname: "" }],
    });
  };

  const removeModel = (modelId: string) => {
    if (provider.models.length <= 1) return;
    onChange({
      ...provider,
      models: provider.models.filter((m) => m.id !== modelId),
    });
  };

  const clearModels = () => {
    onChange({
      ...provider,
      models: [{ id: createModelId(), modelId: "", nickname: "" }],
    });
  };

  return (
    <div className="custom-provider-card">
      <div className="custom-provider-header">
        <span className="custom-provider-badge">OpenAI 兼容</span>
        <button className="link-btn danger" onClick={onRemove}>
          删除分组
        </button>
      </div>

      <div className="settings-group">
        <label className="settings-label">分组名称</label>
        <input
          className="settings-input"
          value={provider.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="例如：云雾 API"
        />
      </div>

      <div className="settings-group">
        <label className="settings-label">API Base URL</label>
        <input
          className="settings-input"
          value={provider.apiBaseUrl}
          onChange={(e) => update({ apiBaseUrl: e.target.value })}
          placeholder="https://yunwu.ai/v1"
        />
        <span className="settings-hint">请勿包含 /chat/completions，仅需填写到 /v1</span>
      </div>

      <div className="settings-group">
        <label className="settings-label">API Key</label>
        <input
          className="settings-input"
          type="password"
          value={provider.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="输入第三方 API Key"
        />
      </div>

      <div className="custom-models-section">
        <div className="custom-models-toolbar">
          <span className="settings-label">模型列表</span>
          <div className="custom-models-actions">
            <button className="link-btn" onClick={clearModels}>
              删除所有
            </button>
            <button className="link-btn" onClick={addModel}>
              + 新建
            </button>
          </div>
        </div>

        <div className="custom-models-table">
          <div className="custom-models-head">
            <span>显示名称</span>
            <span>Model ID</span>
            <span />
          </div>
          {provider.models.map((model) => (
            <div key={model.id} className="custom-models-row">
              <input
                className="settings-input compact-input"
                value={model.nickname}
                onChange={(e) => updateModel(model.id, { nickname: e.target.value })}
                placeholder="optional"
              />
              <input
                className="settings-input compact-input"
                value={model.modelId}
                onChange={(e) => updateModel(model.id, { modelId: e.target.value })}
                placeholder="gpt-4o"
              />
              <button
                className="icon-btn"
                title="删除模型"
                onClick={() => removeModel(model.id)}
                disabled={provider.models.length <= 1}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-test-row">
        <button
          className="btn-secondary"
          style={{ flex: "none", padding: "6px 12px" }}
          onClick={onTest}
          disabled={testing}
        >
          {testing ? "测试中…" : "测试连接"}
        </button>
        {testResult && (
          <span className={`test-result ${testResult.ok ? "ok" : "fail"}`}>
            {testResult.ok ? "连接成功" : testResult.error}
          </span>
        )}
        <span className="settings-hint">
          将使用 {normalizeApiBaseUrl(provider.apiBaseUrl) || "未配置 URL"}
        </span>
      </div>
    </div>
  );
}
