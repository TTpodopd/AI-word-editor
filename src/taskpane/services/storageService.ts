import {
  AppSettings,
  ChatSession,
  ChatSessionsStore,
  DEFAULT_SETTINGS,
  DEFAULT_SYSTEM_PROMPTS,
  DEFAULT_WEB_SEARCH,
  LLMProvider,
  UIMessage,
} from "../types";
import { DEFAULT_THEME_COLOR_ID, resolveThemeColorId } from "../constants/themeColors";
import { resolveChatBottomActionOrder } from "../constants/chatBottomActions";
import { resolveOutputStyleId } from "../prompts/outputStylePresets";

const SETTINGS_KEY = "ai-editor-settings";
const CHAT_SESSIONS_KEY = "ai-editor-chat-sessions";
const CHAT_SESSION_KEY = "ai-editor-chat-session";
const MAX_SESSIONS = 50;

let officeReadyPromise: Promise<void> | null = null;

export function ensureOfficeReady(): Promise<void> {
  if (officeReadyPromise) return officeReadyPromise;

  officeReadyPromise = new Promise((resolve) => {
    if (typeof Office === "undefined") {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => resolve(), 3000);

    Office.onReady(() => {
      window.clearTimeout(timeout);
      resolve();
    });
  });

  return officeReadyPromise;
}

function getOfficeStorage(): OfficeRuntime.Storage | null {
  try {
    return typeof OfficeRuntime !== "undefined" ? OfficeRuntime.storage : null;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function readFromOffice(key: string): Promise<string | null> {
  const storage = getOfficeStorage();
  if (!storage) return null;

  try {
    const value = await storage.getItem(key);
    return value ?? null;
  } catch (err) {
    console.warn(`OfficeRuntime.storage.getItem failed for ${key}`, err);
    return null;
  }
}

async function writeToOffice(key: string, value: string): Promise<boolean> {
  const storage = getOfficeStorage();
  if (!storage) return false;

  try {
    await storage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`OfficeRuntime.storage.setItem failed for ${key}`, err);
    return false;
  }
}

function readFromLocal(key: string): string | null {
  const local = getLocalStorage();
  if (!local) return null;
  try {
    return local.getItem(key);
  } catch (err) {
    console.warn(`localStorage.getItem failed for ${key}`, err);
    return null;
  }
}

function writeToLocal(key: string, value: string): boolean {
  const local = getLocalStorage();
  if (!local) return false;
  try {
    local.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`localStorage.setItem failed for ${key}`, err);
    return false;
  }
}

async function readItem(key: string): Promise<string | null> {
  await ensureOfficeReady();

  const officeValue = await readFromOffice(key);
  const localValue = readFromLocal(key);

  if (officeValue) return officeValue;
  if (localValue) {
    await writeToOffice(key, localValue);
    return localValue;
  }
  return null;
}

async function writeItem(key: string, value: string): Promise<void> {
  await ensureOfficeReady();

  const officeOk = await writeToOffice(key, value);
  const localOk = writeToLocal(key, value);

  if (!officeOk && !localOk) {
    throw new Error("设置保存失败，请重试");
  }

  if (!officeOk) {
    console.warn("OfficeRuntime.storage unavailable, settings saved to localStorage only");
  }
}

function parseSettings(raw: string): AppSettings {
  const parsed = JSON.parse(raw) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...(parsed.apiKeys || {}) },
    proxyAccessToken: parsed.proxyAccessToken || "",
    customProviders: parsed.customProviders || [],
    hiddenModelIds: parsed.hiddenModelIds || [],
    systemPrompts: {
      ...DEFAULT_SYSTEM_PROMPTS,
      ...(parsed.systemPrompts || {}),
    },
    themeColorId: resolveThemeColorId(parsed.themeColorId),
    webSearch: {
      ...DEFAULT_WEB_SEARCH,
      ...(parsed.webSearch || {}),
      resultLimit: Math.min(
        20,
        Math.max(1, Number(parsed.webSearch?.resultLimit) || DEFAULT_WEB_SEARCH.resultLimit)
      ),
    },
    quickApplyEnabled: !!parsed.quickApplyEnabled,
    customWritingTemplates: Array.isArray(parsed.customWritingTemplates)
      ? parsed.customWritingTemplates
      : [],
    hiddenWritingTemplateIds: Array.isArray(parsed.hiddenWritingTemplateIds)
      ? parsed.hiddenWritingTemplateIds.filter((id): id is string => typeof id === "string" && !!id.trim())
      : [],
    outputStyleId: resolveOutputStyleId(parsed.outputStyleId),
    chatBottomActionOrder: resolveChatBottomActionOrder(parsed.chatBottomActionOrder),
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await readItem(SETTINGS_KEY);
  if (raw) {
    try {
      return parseSettings(raw);
    } catch (err) {
      console.warn("Failed to parse saved settings", err);
    }
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeItem(SETTINGS_KEY, JSON.stringify(settings));

  const verify = await readItem(SETTINGS_KEY);
  if (!verify) {
    throw new Error("设置保存后校验失败，请重试");
  }
}

export async function saveApiKey(provider: Exclude<LLMProvider, "custom">, key: string): Promise<void> {
  const settings = await loadSettings();
  settings.apiKeys[provider] = key;
  await saveSettings(settings);
}

export async function saveSelectedModel(modelId: string): Promise<void> {
  const settings = await loadSettings();
  settings.selectedModelId = modelId;
  await saveSettings(settings);
}

export async function saveWebSearchEnabled(enabled: boolean): Promise<void> {
  const settings = await loadSettings();
  settings.webSearch = { ...settings.webSearch, enabled };
  await saveSettings(settings);
}

export function createEmptySession(): ChatSession {
  const now = Date.now();
  return {
    id: `session-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title: "新对话",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function sortSessions(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function orderSessions(sessions: ChatSession[], order?: string[]): ChatSession[] {
  const validSessions = sessions.filter((session) => session && session.id);
  if (!order || order.length === 0) {
    return sortSessions(validSessions);
  }

  const sessionMap = new Map(validSessions.map((session) => [session.id, session]));
  const ordered: ChatSession[] = [];

  order.forEach((id) => {
    const session = sessionMap.get(id);
    if (session) {
      ordered.push(session);
      sessionMap.delete(id);
    }
  });

  sessionMap.forEach((session) => ordered.push(session));
  return ordered;
}

export function ensureSessionOrder(store: ChatSessionsStore): string[] {
  const validIds = new Set(store.sessions.map((session) => session.id));
  const baseOrder =
    store.sessionOrder && store.sessionOrder.length > 0
      ? store.sessionOrder.filter((id) => validIds.has(id))
      : sortSessions(store.sessions).map((session) => session.id);

  store.sessions.forEach((session) => {
    if (!baseOrder.includes(session.id)) {
      baseOrder.unshift(session.id);
    }
  });

  return baseOrder;
}

export function getSessionDisplayTitle(session: ChatSession): string {
  if (session.customTitle?.trim()) return session.customTitle.trim();
  if (session.writingProject?.title?.trim() && session.writingProject.outline.length > 0) {
    return session.writingProject.title.trim();
  }
  return deriveSessionTitle(session.messages);
}

function normalizeStore(store: ChatSessionsStore): ChatSessionsStore {
  const sessions = store.sessions.filter((session) => session && session.id);
  if (sessions.length === 0) {
    const empty = createEmptySession();
    return { activeSessionId: empty.id, sessions: [empty], sessionOrder: [empty.id] };
  }

  const sessionOrder = ensureSessionOrder({ ...store, sessions });
  const orderedSessions = orderSessions(sessions, sessionOrder).map((session) => ({
    ...session,
    title: getSessionDisplayTitle(session),
  }));

  const activeExists = orderedSessions.some((session) => session.id === store.activeSessionId);
  return {
    activeSessionId: activeExists ? store.activeSessionId : orderedSessions[0].id,
    sessions: orderedSessions,
    sessionOrder,
  };
}

export async function loadChatSessions(): Promise<ChatSessionsStore> {
  const raw = await readItem(CHAT_SESSIONS_KEY);
  if (raw) {
    try {
      return normalizeStore(JSON.parse(raw) as ChatSessionsStore);
    } catch {
      // fall through
    }
  }

  const legacyRaw = await readItem(CHAT_SESSION_KEY);
  if (legacyRaw) {
    try {
      const session = JSON.parse(legacyRaw) as ChatSession;
      const store = normalizeStore({
        activeSessionId: session.id,
        sessions: [session],
      });
      await saveChatSessions(store);
      return store;
    } catch {
      // fall through
    }
  }

  const empty = createEmptySession();
  const store = { activeSessionId: empty.id, sessions: [empty] };
  await saveChatSessions(store);
  return store;
}

export async function saveChatSessions(store: ChatSessionsStore): Promise<void> {
  const normalized = normalizeStore(store);
  const trimmed: ChatSessionsStore = {
    ...normalized,
    sessions: normalized.sessions.slice(0, MAX_SESSIONS),
    sessionOrder: normalized.sessionOrder?.slice(0, MAX_SESSIONS),
  };
  if (!trimmed.sessions.some((session) => session.id === trimmed.activeSessionId)) {
    trimmed.activeSessionId = trimmed.sessions[0].id;
  }
  trimmed.sessionOrder = ensureSessionOrder(trimmed);
  await writeItem(CHAT_SESSIONS_KEY, JSON.stringify(trimmed));

  const active = trimmed.sessions.find((s) => s.id === trimmed.activeSessionId);
  if (active) {
    await writeItem(CHAT_SESSION_KEY, JSON.stringify(active));
  }
}

export async function loadChatSession(): Promise<ChatSession> {
  const store = await loadChatSessions();
  return store.sessions.find((s) => s.id === store.activeSessionId) ?? store.sessions[0];
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  const store = await loadChatSessions();
  const idx = store.sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    store.sessions[idx] = session;
  } else {
    store.sessions.unshift(session);
    store.activeSessionId = session.id;
  }
  await saveChatSessions(store);
}

export function deriveSessionTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "新对话";
  const text = firstUser.content.trim();
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

export function formatSessionTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
