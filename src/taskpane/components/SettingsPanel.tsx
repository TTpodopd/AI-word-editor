import React, { useEffect, useMemo, useState } from "react";

import { AppSettings, DEFAULT_SYSTEM_PROMPTS, DEFAULT_WEB_SEARCH, LLMProvider } from "../types";

import { testConnection } from "../services/llmService";

import {

  createEmptyCustomProvider,

  createProviderId,

  ensureSelectedModelVisible,

  getAvailableModels,

  getVisibleModels,

  pruneHiddenModelIds,

  resolveModel,

} from "../services/modelService";

import { CustomProviderEditor } from "./CustomProviderEditor";

import { ModelVisibilitySettings } from "./ModelVisibilitySettings";

import { SettingsCategoryGroup } from "./SettingsCategoryGroup";
import { SettingsCollapsibleSection } from "./SettingsCollapsibleSection";
import { SystemPromptSettingsPanel } from "./SystemPromptSettingsPanel";
import { ThemeColorSettingsPanel } from "./ThemeColorSettingsPanel";
import { WebSearchSettingsPanel } from "./WebSearchSettingsPanel";
import { DEFAULT_THEME_COLOR_ID, getThemeColorPreset, ThemeColorId } from "../constants/themeColors";
import { applyThemeColor } from "../utils/theme";



interface SettingsPanelProps {

  settings: AppSettings;

  onSave: (settings: AppSettings) => void;

}



const PROVIDER_LABELS: Record<Exclude<LLMProvider, "custom">, string> = {

  deepseek: "DeepSeek",

  openai: "OpenAI",

  qwen: "通义千问",

};



const PROVIDER_HINTS: Record<Exclude<LLMProvider, "custom">, string> = {

  deepseek: "在 platform.deepseek.com 获取 API Key",

  openai: "在 platform.openai.com 获取 API Key",

  qwen: "在 dashscope.aliyun.com 获取 API Key",

};



const PROVIDERS: Exclude<LLMProvider, "custom">[] = ["deepseek", "openai", "qwen"];



export function SettingsPanel({ settings, onSave }: SettingsPanelProps) {

  const [localSettings, setLocalSettings] = useState<AppSettings>({
    ...settings,
    customProviders: settings.customProviders || [],
    hiddenModelIds: settings.hiddenModelIds || [],
    systemPrompts: settings.systemPrompts || { ...DEFAULT_SYSTEM_PROMPTS },
    themeColorId: settings.themeColorId || DEFAULT_THEME_COLOR_ID,
    webSearch: settings.webSearch || { ...DEFAULT_WEB_SEARCH },
  });

  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({});

  const [testing, setTesting] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});



  useEffect(() => {

    setLocalSettings({
      ...settings,
      customProviders: settings.customProviders || [],
      hiddenModelIds: settings.hiddenModelIds || [],
      systemPrompts: settings.systemPrompts || { ...DEFAULT_SYSTEM_PROMPTS },
      themeColorId: settings.themeColorId || DEFAULT_THEME_COLOR_ID,
      webSearch: settings.webSearch || { ...DEFAULT_WEB_SEARCH },
    });

  }, [settings]);

  useEffect(() => {
    applyThemeColor(localSettings.themeColorId);
  }, [localSettings.themeColorId]);



  const configuredBuiltinCount = useMemo(

    () => PROVIDERS.filter((provider) => localSettings.apiKeys[provider].trim()).length,

    [localSettings.apiKeys]

  );



  const visibleModelCount = useMemo(

    () => getVisibleModels(localSettings).length,

    [localSettings]

  );



  const totalModelCount = useMemo(

    () => getAvailableModels(localSettings).length,

    [localSettings]

  );



  const isExpanded = (sectionId: string) => !!expandedSections[sectionId];



  const toggleSection = (sectionId: string) => {

    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));

  };



  const handleKeyChange = (provider: Exclude<LLMProvider, "custom">, value: string) => {

    setLocalSettings((prev) => ({

      ...prev,

      apiKeys: { ...prev.apiKeys, [provider]: value },

    }));

  };



  const handleSave = () => {

    const cleaned = ensureSelectedModelVisible(

      pruneHiddenModelIds({

        ...localSettings,

        customProviders: localSettings.customProviders

          .map((provider) => ({

            ...provider,

            models: provider.models.filter((model) => model.modelId.trim()),

          }))

          .filter((provider) => provider.name.trim() && provider.apiBaseUrl.trim()),

      })

    );

    onSave(cleaned);

  };



  const handleVisibilityChange = (hiddenModelIds: string[]) => {
    setLocalSettings((prev) => ensureSelectedModelVisible({ ...prev, hiddenModelIds }));
  };

  const handleSystemPromptsChange = (systemPrompts: AppSettings["systemPrompts"]) => {
    setLocalSettings((prev) => ({ ...prev, systemPrompts }));
  };

  const handleThemeColorChange = (themeColorId: ThemeColorId) => {
    setLocalSettings((prev) => ({ ...prev, themeColorId }));
  };

  const handleWebSearchChange = (webSearch: AppSettings["webSearch"]) => {
    setLocalSettings((prev) => ({ ...prev, webSearch }));
  };

  const webSearchBadge = localSettings.webSearch?.enabled ? "已开启" : "已关闭";

  const selectedThemeLabel = useMemo(
    () => getThemeColorPreset(localSettings.themeColorId).label,
    [localSettings.themeColorId]
  );

  const isSystemPromptCustomized = useMemo(() => {
    const prompts = localSettings.systemPrompts;
    return (
      prompts.withSelection.trim() !== DEFAULT_SYSTEM_PROMPTS.withSelection.trim() ||
      prompts.withoutSelection.trim() !== DEFAULT_SYSTEM_PROMPTS.withoutSelection.trim()
    );
  }, [localSettings.systemPrompts]);



  const handleBuiltinTest = async (provider: Exclude<LLMProvider, "custom">) => {

    const key = localSettings.apiKeys[provider];

    if (!key) {

      setTestResults((prev) => ({

        ...prev,

        [provider]: { ok: false, error: "请先输入 API Key" },

      }));

      return;

    }



    const builtinModel = getAvailableModels(localSettings).find((model) => model.provider === provider);

    const resolved = builtinModel ? resolveModel(localSettings, builtinModel.id) : null;



    setTesting(provider);

    const result = resolved
      ? await testConnection(resolved, { proxyAccessToken: localSettings.proxyAccessToken })
      : { ok: false, error: "无可用模型" };

    setTestResults((prev) => ({ ...prev, [provider]: result }));

    setTesting(null);

  };



  const handleCustomTest = async (providerId: string) => {

    const provider = localSettings.customProviders.find((item) => item.id === providerId);

    if (!provider) return;



    const firstModel = provider.models.find((model) => model.modelId.trim());

    if (!firstModel) {

      setTestResults((prev) => ({

        ...prev,

        [providerId]: { ok: false, error: "请先添加至少一个 Model ID" },

      }));

      return;

    }



    const resolved = resolveModel(localSettings, `custom-${providerId}-${firstModel.id}`);

    setTesting(providerId);

    const result = resolved
      ? await testConnection(resolved, { proxyAccessToken: localSettings.proxyAccessToken })
      : { ok: false, error: "配置无效" };

    setTestResults((prev) => ({ ...prev, [providerId]: result }));

    setTesting(null);

  };



  const addCustomProvider = () => {

    const newProvider = createEmptyCustomProvider();

    setLocalSettings((prev) => ({

      ...prev,

      customProviders: [...prev.customProviders, newProvider],

    }));

    setExpandedSections((prev) => ({

      ...prev,

      "section-custom-api": true,

      [`custom-${newProvider.id}`]: true,

    }));

  };



  const updateCustomProvider = (index: number, provider: AppSettings["customProviders"][0]) => {

    setLocalSettings((prev) => ({

      ...prev,

      customProviders: prev.customProviders.map((item, itemIndex) =>

        itemIndex === index ? provider : item

      ),

    }));

  };



  const removeCustomProvider = (index: number) => {

    const providerId = localSettings.customProviders[index]?.id;

    setLocalSettings((prev) => ({

      ...prev,

      customProviders: prev.customProviders.filter((_, itemIndex) => itemIndex !== index),

    }));

    if (providerId) {

      setExpandedSections((prev) => {

        const next = { ...prev };

        delete next[`custom-${providerId}`];

        return next;

      });

    }

  };



  return (

    <div className="settings-panel">

      <div className="settings-panel-intro">
        <h3 className="settings-title">设置</h3>
        <p className="settings-hint">按类别整理配置项，API Key 仅保存在本机，不会上传到服务器。</p>
      </div>

      <div className="settings-collapse-list">
        <SettingsCategoryGroup
          title="模型与接口"
          description="配置 API 密钥、第三方服务与对话区可选模型。"
        >
          <SettingsCollapsibleSection
            title="代理访问控制"
            description="线上部署时，防止他人滥用你的 Vercel API 代理。"
            badge={localSettings.proxyAccessToken?.trim() ? "已配置" : "未配置"}
            expanded={isExpanded("section-proxy-access")}
            onToggle={() => toggleSection("section-proxy-access")}
          >
            <div className="settings-group">
              <label className="settings-label" htmlFor="proxy-access-token">
                代理访问令牌
              </label>
              <input
                id="proxy-access-token"
                className="settings-input"
                type="password"
                value={localSettings.proxyAccessToken || ""}
                onChange={(event) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    proxyAccessToken: event.target.value,
                  }))
                }
                placeholder="与 Vercel 环境变量 PROXY_ACCESS_TOKEN 保持一致"
                autoComplete="off"
              />
              <p className="settings-hint">
                与 Vercel 环境变量 PROXY_ACCESS_TOKEN 完全一致（区分大小写）。仅保存在本机，不会提交到 GitHub。
              </p>
            </div>
          </SettingsCollapsibleSection>

          <SettingsCollapsibleSection
            title="官方 API"
            description="DeepSeek、OpenAI、通义千问等官方接口密钥。"
            badge={`${configuredBuiltinCount}/${PROVIDERS.length} 已配置`}
            expanded={isExpanded("section-builtin-api")}
            onToggle={() => toggleSection("section-builtin-api")}
          >

          <div className="settings-nested-list">

            {PROVIDERS.map((provider) => {

              const configured = !!localSettings.apiKeys[provider].trim();

              return (

                <SettingsCollapsibleSection

                  key={provider}

                  nested

                  title={`${PROVIDER_LABELS[provider]} API`}

                  badge={configured ? "已配置" : "未配置"}

                  expanded={isExpanded(`builtin-${provider}`)}

                  onToggle={() => toggleSection(`builtin-${provider}`)}

                >

                  <div className="settings-group">

                    <label className="settings-label">{PROVIDER_LABELS[provider]} API Key</label>

                    <input

                      className="settings-input"

                      type="password"

                      placeholder={`输入 ${PROVIDER_LABELS[provider]} API Key`}

                      value={localSettings.apiKeys[provider]}

                      onChange={(event) => handleKeyChange(provider, event.target.value)}

                    />

                    <span className="settings-hint">{PROVIDER_HINTS[provider]}</span>

                    <div className="settings-test-row">

                      <button

                        className="btn-secondary settings-test-btn"

                        onClick={() => handleBuiltinTest(provider)}

                        disabled={testing === provider}

                      >

                        {testing === provider ? "测试中…" : "测试连接"}

                      </button>

                      {testResults[provider] && (

                        <span className={`test-result ${testResults[provider].ok ? "ok" : "fail"}`}>

                          {testResults[provider].ok ? "连接成功" : testResults[provider].error}

                        </span>

                      )}

                    </div>

                  </div>

                </SettingsCollapsibleSection>

              );

            })}

          </div>
          </SettingsCollapsibleSection>

          <SettingsCollapsibleSection
            title="OpenAI 兼容第三方 API"
            description="云雾、OneAPI、New API 等 OpenAI 协议兼容服务。"
            badge={`${localSettings.customProviders.length} 个分组`}
            expanded={isExpanded("section-custom-api")}
            onToggle={() => toggleSection("section-custom-api")}
            headerAction={
              <button type="button" className="link-btn" onClick={addCustomProvider}>
                + 添加分组
              </button>
            }
          >

          {localSettings.customProviders.length === 0 ? (

            <div className="custom-provider-empty">暂无自定义分组，点击「添加分组」开始配置。</div>

          ) : (

            <div className="settings-nested-list">

              {localSettings.customProviders.map((provider, index) => {

                const modelCount = provider.models.filter((model) => model.modelId.trim()).length;

                const sectionId = `custom-${provider.id}`;

                return (

                  <SettingsCollapsibleSection

                    key={provider.id || createProviderId()}

                    nested

                    title={provider.name.trim() || "未命名分组"}

                    badge={`${modelCount} 个模型`}

                    expanded={isExpanded(sectionId)}

                    onToggle={() => toggleSection(sectionId)}

                  >

                    <CustomProviderEditor

                      provider={provider}

                      onChange={(next) => updateCustomProvider(index, next)}

                      onRemove={() => removeCustomProvider(index)}

                      onTest={() => handleCustomTest(provider.id)}

                      testing={testing === provider.id}

                      testResult={testResults[provider.id]}

                    />

                  </SettingsCollapsibleSection>

                );

              })}

            </div>

          )}
          </SettingsCollapsibleSection>

          <SettingsCollapsibleSection
            title="模型显示"
            description="勾选要在对话区显示的模型，取消勾选即可隐藏。"
            badge={`显示 ${visibleModelCount}/${totalModelCount}`}
            expanded={isExpanded("section-model-visibility")}
            onToggle={() => toggleSection("section-model-visibility")}
          >
            <ModelVisibilitySettings settings={localSettings} onChange={handleVisibilityChange} />
          </SettingsCollapsibleSection>
        </SettingsCategoryGroup>

        <SettingsCategoryGroup title="对话能力" description="联网搜索与 AI 回复行为相关配置。">
          <SettingsCollapsibleSection
            title="联网搜索"
            description="通过 Tavily API 获取实时网络信息。"
            badge={webSearchBadge}
            expanded={isExpanded("section-web-search")}
            onToggle={() => toggleSection("section-web-search")}
          >
            <WebSearchSettingsPanel
              settings={localSettings.webSearch || { ...DEFAULT_WEB_SEARCH }}
              onChange={handleWebSearchChange}
            />
          </SettingsCollapsibleSection>

          <SettingsCollapsibleSection
            title="系统提示词"
            description="定义 AI 在有/无选区时的角色与回复规则。"
            badge={isSystemPromptCustomized ? "已自定义" : "默认"}
            expanded={isExpanded("section-system-prompts")}
            onToggle={() => toggleSection("section-system-prompts")}
          >
            <SystemPromptSettingsPanel
              prompts={localSettings.systemPrompts}
              onChange={handleSystemPromptsChange}
            />
          </SettingsCollapsibleSection>
        </SettingsCategoryGroup>

        <SettingsCategoryGroup title="界面外观" description="侧栏主题色与视觉风格。">
          <SettingsCollapsibleSection
            title="主题颜色"
            description="马卡龙、多巴胺、克莱因蓝等融合色系。"
            badge={selectedThemeLabel}
            expanded={isExpanded("section-theme-color")}
            onToggle={() => toggleSection("section-theme-color")}
          >
            <ThemeColorSettingsPanel
              value={localSettings.themeColorId || DEFAULT_THEME_COLOR_ID}
              onChange={handleThemeColorChange}
            />
          </SettingsCollapsibleSection>
        </SettingsCategoryGroup>
      </div>



      <div className="settings-panel-footer">

        <button className="btn-primary" onClick={handleSave}>

          保存设置

        </button>

      </div>

    </div>

  );

}


