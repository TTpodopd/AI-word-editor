import { AppSettings, ChatMessage, LLMProvider, ResolvedModel } from "../types";
import { apiFetch } from "./apiClient";

export interface ChatRequest {
  provider: LLMProvider;
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  apiBaseUrl?: string;
}

export interface ChatResponse {
  content: string;
  error?: string;
}

const API_BASE = "/api";

export async function sendChat(
  request: ChatRequest,
  settingsOverride?: Pick<AppSettings, "proxyAccessToken">
): Promise<ChatResponse> {
  const response = await apiFetch(
    `${API_BASE}/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": request.apiKey,
      },
      body: JSON.stringify({
        provider: request.provider,
        model: request.model,
        messages: request.messages,
        apiBaseUrl: request.apiBaseUrl,
      }),
    },
    settingsOverride
  );

  const data = await response.json();

  if (!response.ok) {
    return { content: "", error: data.error || `请求失败 (${response.status})` };
  }

  return { content: data.content || "" };
}

export async function sendChatWithModel(
  model: ResolvedModel,
  messages: ChatMessage[],
  settingsOverride?: Pick<AppSettings, "proxyAccessToken">
): Promise<ChatResponse> {
  if (!model.apiKey) {
    return { content: "", error: "请先在设置中配置 API Key" };
  }

  return sendChat(
    {
      provider: model.provider,
      model: model.model,
      apiKey: model.apiKey,
      messages,
      apiBaseUrl: model.apiBaseUrl,
    },
    settingsOverride
  );
}

export async function testConnection(
  model: ResolvedModel,
  settingsOverride?: Pick<AppSettings, "proxyAccessToken">
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendChatWithModel(model, [{ role: "user", content: "Hi" }], settingsOverride);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}
