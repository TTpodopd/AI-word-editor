import React, { useMemo, useState } from "react";
import { DEFAULT_WEB_SEARCH, WebSearchSettings } from "../types";
import { testWebSearchConnection } from "../services/webSearchService";

interface WebSearchSettingsPanelProps {
  settings: WebSearchSettings;
  onChange: (settings: WebSearchSettings) => void;
}

export function WebSearchSettingsPanel({ settings, onChange }: WebSearchSettingsPanelProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const isCustomized = useMemo(
    () => settings.systemPrompt.trim() !== DEFAULT_WEB_SEARCH.systemPrompt.trim(),
    [settings.systemPrompt]
  );

  const update = (patch: Partial<WebSearchSettings>) => {
    onChange({ ...settings, ...patch });
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testWebSearchConnection(settings);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        ok: false,
        error: error instanceof Error ? error.message : "测试连接失败",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="web-search-settings">
      <div className="settings-group">
        <div className="settings-label-row">
          <label className="settings-label">启用联网搜索</label>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>
        <span className="settings-hint">启用模型内置搜索后，此插件联网功能将不适用。</span>
      </div>

      <div className="settings-group">
        <label className="settings-label">搜索引擎</label>
        <select
          className="settings-select"
          value={settings.provider}
          onChange={(event) => update({ provider: event.target.value as WebSearchSettings["provider"] })}
        >
          <option value="tavily">Tavily（API 密钥）</option>
        </select>
        <span className="settings-hint">使用 Tavily API 获取搜索结果。</span>
      </div>

      <div className="settings-group">
        <label className="settings-label">Tavily API 密钥</label>
        <div className="settings-input-row">
          <input
            className="settings-input"
            type={showApiKey ? "text" : "password"}
            value={settings.apiKey}
            onChange={(event) => update({ apiKey: event.target.value })}
            placeholder="tvly-..."
          />
          <button
            type="button"
            className="icon-btn settings-input-action"
            title={showApiKey ? "隐藏密钥" : "显示密钥"}
            onClick={() => setShowApiKey((prev) => !prev)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              {showApiKey ? (
                <path
                  d="M2 2l12 12M6.7 6.8A2.7 2.7 0 0 0 8 10.7M4.2 4.5A7.2 7.2 0 0 0 1 8c1.2 2.4 3.5 4 6 4a6.2 6.2 0 0 0 2.2-.4M9.5 9.4A2.7 2.7 0 0 0 8 5.3M11.8 11.5A7.2 7.2 0 0 0 15 8c-1.2-2.4-3.5-4-6-4-.7 0-1.4.1-2 .3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M1 8s2.5-4 7-4 7 4 7 4-2.5 4-7 4-7-4-7-4zM8 10.2A2.2 2.2 0 1 0 8 5.8a2.2 2.2 0 0 0 0 4.4z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
        </div>
        <div className="settings-inline-actions">
          <button type="button" className="btn-secondary" onClick={handleTest} disabled={testing || !settings.apiKey.trim()}>
            {testing ? "测试中…" : "测试连接"}
          </button>
          {testResult && (
            <span className={`settings-test-result${testResult.ok ? " ok" : " err"}`}>
              {testResult.ok ? "连接成功" : testResult.error || "连接失败"}
            </span>
          )}
        </div>
      </div>

      <div className="settings-group">
        <label className="settings-label">排除网站</label>
        <input
          className="settings-input"
          value={settings.excludeDomains}
          onChange={(event) => update({ excludeDomains: event.target.value })}
          placeholder="a.com,b.com"
        />
        <span className="settings-hint">多个域名用英文逗号分隔，搜索结果将排除这些网站。</span>
      </div>

      <div className="settings-group">
        <label className="settings-label">搜索结果上限</label>
        <input
          className="settings-input settings-input-narrow"
          type="number"
          min={1}
          max={20}
          value={settings.resultLimit}
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10);
            update({ resultLimit: Number.isFinite(value) ? Math.min(20, Math.max(1, value)) : 8 });
          }}
        />
        <span className="settings-hint">每次联网搜索返回的结果条数，建议 5–10 条。</span>
      </div>

      <div className="settings-group">
        <div className="settings-label-row">
          <label className="settings-label">系统提示词</label>
          {isCustomized && (
            <button type="button" className="link-btn" onClick={() => update({ systemPrompt: DEFAULT_WEB_SEARCH.systemPrompt })}>
              恢复默认
            </button>
          )}
        </div>
        <textarea
          className="settings-textarea"
          value={settings.systemPrompt}
          onChange={(event) => update({ systemPrompt: event.target.value })}
          rows={6}
        />
        <span className="settings-hint">联网开启时追加到系统提示词，指导 AI 如何使用搜索结果。</span>
      </div>
    </div>
  );
}
