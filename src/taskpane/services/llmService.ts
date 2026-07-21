import { AppSettings, ChatMessage, LLMProvider, ResolvedModel } from "../types";
import { buildApiHeaders } from "./apiClient";

export interface ChatRequest {
  provider: LLMProvider;
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  apiBaseUrl?: string;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  error?: string;
  aborted?: boolean;
}

export interface StreamChatOptions {
  request: ChatRequest;
  signal?: AbortSignal;
  onChunk?: (delta: string, fullContent: string) => void;
  settingsOverride?: Pick<AppSettings, "proxyAccessToken">;
}

const API_BASE = "/api";

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getErrorMessage(data: Record<string, unknown>, status: number): string {
  return String(data.error || `请求失败 (${status})`);
}

async function consumeSseStream(
  response: Response,
  onChunk: StreamChatOptions["onChunk"],
  signal?: AbortSignal
): Promise<ChatResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    return { content: "", error: "无法读取流式响应" };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let onAbort: (() => void) | undefined;

  if (signal) {
    onAbort = () => {
      void reader.cancel().catch(() => undefined);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        return { content: fullContent, aborted: true };
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        for (const line of event.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as { content?: string; error?: string };
            if (parsed.error) {
              return { content: fullContent, error: parsed.error };
            }
            if (parsed.content) {
              fullContent += parsed.content;
              onChunk?.(parsed.content, fullContent);
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      return { content: fullContent, aborted: true };
    }
    return {
      content: fullContent,
      error: error instanceof Error ? error.message : "流式响应读取失败",
    };
  } finally {
    if (signal && onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }

  return { content: fullContent };
}

export async function sendChat(
  request: ChatRequest,
  settingsOverride?: Pick<AppSettings, "proxyAccessToken">,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const headers = await buildApiHeaders(
    {
      "Content-Type": "application/json",
      "X-API-Key": request.apiKey,
    },
    settingsOverride
  );

  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: request.provider,
      model: request.model,
      messages: request.messages,
      apiBaseUrl: request.apiBaseUrl,
      stream: false,
    }),
    signal,
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    return { content: "", error: getErrorMessage(data, response.status) };
  }

  return { content: String(data.content || "") };
}

export async function sendChatStream(options: StreamChatOptions): Promise<ChatResponse> {
  const { request, signal, onChunk, settingsOverride } = options;

  const headers = await buildApiHeaders(
    {
      "Content-Type": "application/json",
      "X-API-Key": request.apiKey,
    },
    settingsOverride
  );

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider: request.provider,
        model: request.model,
        messages: request.messages,
        apiBaseUrl: request.apiBaseUrl,
        stream: true,
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      return { content: "", aborted: true };
    }
    return {
      content: "",
      error: error instanceof Error ? error.message : "请求失败",
    };
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return consumeSseStream(response, onChunk, signal);
  }

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    return { content: "", error: getErrorMessage(data, response.status) };
  }

  const content = String(data.content || "");
  if (content) {
    onChunk?.(content, content);
  }
  return { content };
}

export async function sendChatWithModel(
  model: ResolvedModel,
  messages: ChatMessage[],
  settingsOverride?: Pick<AppSettings, "proxyAccessToken">,
  signal?: AbortSignal
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
    settingsOverride,
    signal
  );
}

export async function sendChatStreamWithModel(
  model: ResolvedModel,
  messages: ChatMessage[],
  options: Omit<StreamChatOptions, "request"> = {}
): Promise<ChatResponse> {
  if (!model.apiKey) {
    return { content: "", error: "请先在设置中配置 API Key" };
  }

  return sendChatStream({
    ...options,
    request: {
      provider: model.provider,
      model: model.model,
      apiKey: model.apiKey,
      messages,
      apiBaseUrl: model.apiBaseUrl,
      stream: true,
    },
  });
}

export async function testConnection(
  model: ResolvedModel,
  settingsOverride?: Pick<AppSettings, "proxyAccessToken">
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendChatWithModel(model, [{ role: "user", content: "Hi" }], settingsOverride);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}
