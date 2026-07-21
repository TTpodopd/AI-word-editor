import { ChatMessage, WebSearchSettings } from "../types";
import { apiFetch } from "./apiClient";
import { appendTextToMessageContent, getTextFromMessageContent } from "./multimodalService";

export interface WebSearchResultItem {
  title: string;
  url: string;
  content: string;
}

export interface WebSearchResponse {
  results: WebSearchResultItem[];
  error?: string;
}

const API_BASE = "/api";
const DEFAULT_TIMEOUT_MS = 25000;
const TEST_TIMEOUT_MS = 30000;

function parseExcludeDomains(raw: string): string[] {
  return raw
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    if (externalSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    return await apiFetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted || externalSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒），请检查网络或代理服务`);
    }
    throw new Error("无法连接本地代理服务，请先运行 npm start 并保持终端开启");
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (!response.ok) {
      throw new Error(`服务异常 (${response.status})，请重启 npm start 后重试`);
    }
    throw new Error("服务返回了无效数据，请确认代理服务已更新并重启 npm start");
  }
}

async function ensureProxyReady(timeoutMs = 8000): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/health`, { method: "GET" }, timeoutMs);
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error("本地代理服务不可用，请先运行 npm start");
  }

  if (data.supportsWebSearch !== true) {
    throw new Error("代理服务版本过旧，请重启 npm start 以加载联网搜索接口");
  }
}

export function formatWebSearchResults(results: WebSearchResultItem[]): string {
  if (results.length === 0) return "未找到相关搜索结果。";

  return results
    .map((item, index) => {
      const snippet = item.content.trim() || "（无摘要）";
      return `${index + 1}. ${item.title}\n来源：${item.url}\n摘要：${snippet}`;
    })
    .join("\n\n");
}

export async function searchWeb(
  query: string,
  settings: WebSearchSettings,
  signal?: AbortSignal
): Promise<WebSearchResponse> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    return { results: [], error: "未配置 Tavily API Key" };
  }

  if (signal?.aborted) {
    return { results: [], error: "已取消" };
  }

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/web-search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          provider: settings.provider,
          query,
          maxResults: settings.resultLimit,
          excludeDomains: parseExcludeDomains(settings.excludeDomains),
        }),
      },
      DEFAULT_TIMEOUT_MS,
      signal
    );

    const data = await readJsonResponse(response);
    if (!response.ok) {
      return {
        results: [],
        error: String(data.error || `搜索请求失败 (${response.status})`),
      };
    }

    const results = Array.isArray(data.results) ? (data.results as WebSearchResultItem[]) : [];
    return { results };
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      return { results: [], error: "已取消" };
    }
    return {
      results: [],
      error: error instanceof Error ? error.message : "联网搜索失败",
    };
  }
}

export async function testWebSearchConnection(settings: WebSearchSettings): Promise<{
  ok: boolean;
  error?: string;
}> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    return { ok: false, error: "请先填写 Tavily API Key" };
  }

  try {
    await ensureProxyReady();

    const response = await fetchWithTimeout(
      `${API_BASE}/web-search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          provider: settings.provider,
          query: "hello",
          maxResults: 1,
          excludeDomains: [],
        }),
      },
      TEST_TIMEOUT_MS
    );

    const data = await readJsonResponse(response);
    if (!response.ok) {
      return { ok: false, error: String(data.error || `测试失败 (${response.status})`) };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "测试连接失败" };
  }
}

export async function augmentMessagesWithWebSearch(
  apiMessages: ChatMessage[],
  userQuery: string,
  webSearch: WebSearchSettings,
  signal?: AbortSignal
): Promise<{
  messages: ChatMessage[];
  searchQuery?: string;
  searchResults?: WebSearchResultItem[];
  searchError?: string;
}> {
  if (!webSearch.enabled || !webSearch.apiKey.trim()) {
    return { messages: apiMessages };
  }

  const searchQuery = userQuery.trim();
  if (!searchQuery) {
    return { messages: apiMessages };
  }

  const searchResult = await searchWeb(searchQuery, webSearch, signal);
  if (signal?.aborted) {
    return { messages: apiMessages, searchQuery, searchError: "已取消" };
  }
  const messages = apiMessages.map((message) => ({ ...message }));

  if (messages[0]?.role === "system") {
    const prompt = webSearch.systemPrompt.trim();
    if (prompt) {
      messages[0] = {
        ...messages[0],
        content: `${messages[0].content}\n\n${prompt}`,
      };
    }
  }

  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];
  if (lastMessage?.role !== "user") {
    return {
      messages,
      searchQuery,
      searchResults: searchResult.results,
      searchError: searchResult.error,
    };
  }

  if (searchResult.error) {
    messages[lastIndex] = {
      ...lastMessage,
      content: appendTextToMessageContent(
        lastMessage.content,
        `\n\n（联网搜索失败：${searchResult.error}，请基于已有知识回答。）`
      ),
    };
    return {
      messages,
      searchQuery,
      searchResults: [],
      searchError: searchResult.error,
    };
  }

  const formatted = formatWebSearchResults(searchResult.results);
  const searchBlock = `【联网搜索结果】\n${formatted}\n\n【用户问题】\n`;
  const userText = getTextFromMessageContent(lastMessage.content);

  if (typeof lastMessage.content === "string") {
    messages[lastIndex] = {
      ...lastMessage,
      content: `${searchBlock}${userText}`,
    };
  } else {
    const parts = lastMessage.content.map((part) => ({ ...part }));
    const textIndex = parts.findIndex((part) => part.type === "text");
    if (textIndex >= 0 && parts[textIndex].type === "text") {
      parts[textIndex] = { type: "text", text: `${searchBlock}${parts[textIndex].text}` };
    } else {
      parts.unshift({ type: "text", text: searchBlock });
    }
    messages[lastIndex] = { ...lastMessage, content: parts };
  }

  return {
    messages,
    searchQuery,
    searchResults: searchResult.results,
  };
}
