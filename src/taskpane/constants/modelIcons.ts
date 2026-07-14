import { LLMProvider, ModelConfig } from "../types";

const BUILTIN_MODEL_SYMBOLS: Record<string, string> = {
  "deepseek-r1": "R1",
  "deepseek-chat": "DS",
  "gpt-4o": "4o",
  "gpt-4o-mini": "m",
  "qwen-plus": "千",
  "qwen-turbo": "T",
};

const PROVIDER_SYMBOLS: Record<LLMProvider, string> = {
  deepseek: "D",
  openai: "G",
  qwen: "Q",
  custom: "·",
};

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCustomSymbol(label: string, model: string): string {
  const source = label.trim() || model.trim();
  if (!source) return "·";
  const first = source.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "").charAt(0);
  if (!first) return "·";
  if (/[a-zA-Z]/.test(first)) return first.toUpperCase();
  return first;
}

export function getModelIconSymbol(
  model: Pick<ModelConfig, "id" | "provider" | "label" | "model" | "customProviderId">
): string {
  const builtin = BUILTIN_MODEL_SYMBOLS[model.id];
  if (builtin) return builtin;

  if (model.provider === "custom") {
    return getCustomSymbol(model.label, model.model);
  }

  return PROVIDER_SYMBOLS[model.provider];
}

/** 自定义模型在主题色基础上做轻微层次区分（0-3） */
export function getModelIconVariant(
  model: Pick<ModelConfig, "id" | "provider" | "customProviderId">
): number {
  if (model.provider !== "custom") return 0;
  const seed = model.customProviderId || model.id;
  return hashText(seed) % 4;
}
