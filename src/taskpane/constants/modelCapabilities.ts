import { ModelConfig, ResolvedModel } from "../types";

type VisionCheckModel = Pick<ModelConfig | ResolvedModel, "model" | "label" | "provider"> &
  Partial<Pick<ModelConfig, "customProviderId">>;

const NON_VISION_MODEL_PATTERNS = [
  /deepseek-reasoner/i,
  /deepseek-chat/i,
  /deepseek-r1/i,
  /qwen-turbo/i,
  /qwen-plus/i,
  /qwen-max(?!.*vl)/i,
];

const VISION_MODEL_PATTERNS = [
  /gpt-4o/i,
  /gpt-4-turbo/i,
  /gpt-4-vision/i,
  /gpt-[45]/i,
  /gpt-5/i,
  /o[1-4](?:-mini|-preview)?/i,
  /qwen-vl/i,
  /qwen2-vl/i,
  /qwen3-vl/i,
  /deepseek-vl/i,
  /janus/i,
  /gemini/i,
  /claude-3/i,
  /claude-sonnet-4/i,
  /claude-opus-4/i,
  /glm-4v/i,
  /yi-vision/i,
  /luna/i,
  /multimodal/i,
  /vision/i,
  /vl-/i,
  /-vl/i,
];

export function modelSupportsVision(model: VisionCheckModel): boolean {
  if (model.provider === "custom" || model.customProviderId) {
    return true;
  }

  const source = `${model.model} ${model.label}`;

  if (NON_VISION_MODEL_PATTERNS.some((pattern) => pattern.test(source))) {
    return false;
  }

  if (VISION_MODEL_PATTERNS.some((pattern) => pattern.test(source))) {
    return true;
  }

  return true;
}

export function hasImageAttachments(attachments: { kind: string }[]): boolean {
  return attachments.some((item) => item.kind === "image");
}
