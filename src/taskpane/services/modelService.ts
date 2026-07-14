import {
  AppSettings,
  BUILTIN_MODEL_OPTIONS,
  CustomProvider,
  ModelConfig,
  ResolvedModel,
} from "../types";

export function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
}

function formatModelLabel(label: string, modelId: string): string {
  const text = label.trim() || modelId.trim();
  if (!text) return "未命名模型";
  return text;
}

export function getAvailableModels(settings: AppSettings): ModelConfig[] {
  const customModels = settings.customProviders.flatMap((provider) =>
    provider.models.map((m) => ({
      id: `custom-${provider.id}-${m.id}`,
      provider: "custom" as const,
      model: m.modelId,
      label: formatModelLabel(m.nickname, m.modelId),
      customProviderId: provider.id,
      apiBaseUrl: normalizeApiBaseUrl(provider.apiBaseUrl),
    }))
  );

  return [...BUILTIN_MODEL_OPTIONS, ...customModels];
}

export function getVisibleModels(settings: AppSettings): ModelConfig[] {
  const hidden = new Set(settings.hiddenModelIds || []);
  return getAvailableModels(settings).filter((model) => !hidden.has(model.id));
}

export function pruneHiddenModelIds(settings: AppSettings): AppSettings {
  const validIds = new Set(getAvailableModels(settings).map((model) => model.id));
  return {
    ...settings,
    hiddenModelIds: (settings.hiddenModelIds || []).filter((id) => validIds.has(id)),
  };
}

export function ensureSelectedModelVisible(settings: AppSettings): AppSettings {
  const cleaned = pruneHiddenModelIds(settings);
  const visible = getVisibleModels(cleaned);
  if (visible.length === 0) return cleaned;

  if (!visible.some((model) => model.id === cleaned.selectedModelId)) {
    return { ...cleaned, selectedModelId: visible[0].id };
  }

  return cleaned;
}

export function resolveModel(settings: AppSettings, modelId?: string): ResolvedModel | null {
  const all = getAvailableModels(settings);
  const visible = getVisibleModels(settings);
  const preferred = modelId
    ? all.find((model) => model.id === modelId)
    : visible.find((model) => model.id === settings.selectedModelId) || visible[0] || all[0];
  const config = preferred || all[0];
  if (!config) return null;

  if (config.provider === "custom" && config.customProviderId) {
    const provider = settings.customProviders.find((p) => p.id === config.customProviderId);
    if (!provider) return null;

    return {
      id: config.id,
      provider: "custom",
      model: config.model,
      label: config.label,
      apiKey: provider.apiKey,
      apiBaseUrl: normalizeApiBaseUrl(provider.apiBaseUrl),
    };
  }

  if (config.provider === "custom") {
    return null;
  }

  return {
    id: config.id,
    provider: config.provider,
    model: config.model,
    label: config.label,
    apiKey: settings.apiKeys[config.provider],
  };
}

export function createEmptyCustomProvider(): CustomProvider {
  return {
    id: createProviderId(),
    name: "自定义分组",
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    models: [{ id: createModelId(), modelId: "", nickname: "" }],
  };
}

export function createProviderId(): string {
  return `provider-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createModelId(): string {
  return `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
