import { ChatSession, ChatSessionsStore, UIMessage, createId } from "../types";
import {
  ensureSessionOrder,
  getSessionDisplayTitle,
  loadChatSessions,
  saveChatSessions,
} from "./storageService";

export const SESSIONS_EXPORT_VERSION = 1;

export interface ChatSessionsExportFile {
  version: typeof SESSIONS_EXPORT_VERSION;
  exportedAt: number;
  app: "ai-word-editor";
  store: ChatSessionsStore;
}

export interface ImportSessionsResult {
  store: ChatSessionsStore;
  importedCount: number;
  skippedCount: number;
  renamedCount: number;
}

function sanitizeMessage(message: Partial<UIMessage>): UIMessage | null {
  if (!message || (message.role !== "user" && message.role !== "assistant")) {
    return null;
  }

  return {
    id: String(message.id || createId()),
    role: message.role,
    content: String(message.content || ""),
    timestamp: Number(message.timestamp) || Date.now(),
    attachments: Array.isArray(message.attachments) ? message.attachments : undefined,
    applyMode: message.applyMode,
    sourceText: message.sourceText,
    actionLabel: message.actionLabel,
    actionId: message.actionId,
    searchInfo: message.searchInfo,
    status: message.status || "done",
    error: message.error,
  };
}

function sanitizeSession(session: Partial<ChatSession>): ChatSession | null {
  if (!session?.id) return null;

  const messages = Array.isArray(session.messages)
    ? session.messages.map(sanitizeMessage).filter((item): item is UIMessage => !!item)
    : [];

  const createdAt = Number(session.createdAt) || Date.now();
  const updatedAt = Number(session.updatedAt) || createdAt;

  const normalized: ChatSession = {
    id: String(session.id),
    title: String(session.title || "导入的对话"),
    customTitle: session.customTitle ? String(session.customTitle) : undefined,
    messages,
    writingProject: session.writingProject ?? undefined,
    createdAt,
    updatedAt,
  };

  normalized.title = getSessionDisplayTitle(normalized);
  return normalized;
}

function parseExportPayload(raw: unknown): ChatSessionsStore {
  if (!raw || typeof raw !== "object") {
    throw new Error("文件格式无效");
  }

  const payload = raw as Partial<ChatSessionsExportFile> & Partial<ChatSessionsStore>;

  const storeCandidate =
    payload.store && typeof payload.store === "object"
      ? payload.store
      : Array.isArray(payload.sessions)
        ? (payload as ChatSessionsStore)
        : null;

  if (!storeCandidate || !Array.isArray(storeCandidate.sessions)) {
    throw new Error("未找到可导入的会话数据");
  }

  const sessions = storeCandidate.sessions
    .map(sanitizeSession)
    .filter((item): item is ChatSession => !!item);

  if (sessions.length === 0) {
    throw new Error("导入文件中没有有效会话");
  }

  return {
    activeSessionId: String(storeCandidate.activeSessionId || sessions[0].id),
    sessions,
    sessionOrder: Array.isArray(storeCandidate.sessionOrder)
      ? storeCandidate.sessionOrder.map(String)
      : undefined,
  };
}

function cloneSessionWithNewId(session: ChatSession): ChatSession {
  const nextId = `session-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    ...session,
    id: nextId,
    messages: session.messages.map((message) => ({ ...message, id: createId() })),
  };
}

export function mergeSessionStores(
  current: ChatSessionsStore,
  incoming: ChatSessionsStore
): ImportSessionsResult {
  const existingIds = new Set(current.sessions.map((session) => session.id));
  const mergedSessions = [...current.sessions];
  const mergedOrder = [...ensureSessionOrder(current)];

  let importedCount = 0;
  let skippedCount = 0;
  let renamedCount = 0;

  const incomingOrder = ensureSessionOrder(incoming);

  incomingOrder.forEach((sessionId) => {
    const session = incoming.sessions.find((item) => item.id === sessionId);
    if (!session) return;

    let nextSession = session;
    if (existingIds.has(session.id)) {
      nextSession = cloneSessionWithNewId(session);
      renamedCount += 1;
    }

    mergedSessions.unshift(nextSession);
    mergedOrder.unshift(nextSession.id);
    existingIds.add(nextSession.id);
    importedCount += 1;
  });

  incoming.sessions.forEach((session) => {
    if (incomingOrder.includes(session.id)) return;
    if (existingIds.has(session.id)) {
      skippedCount += 1;
      return;
    }

    mergedSessions.unshift(session);
    mergedOrder.unshift(session.id);
    existingIds.add(session.id);
    importedCount += 1;
  });

  const store: ChatSessionsStore = {
    activeSessionId: current.activeSessionId,
    sessions: mergedSessions,
    sessionOrder: mergedOrder,
  };

  return {
    store,
    importedCount,
    skippedCount,
    renamedCount,
  };
}

export async function buildSessionsExportFile(): Promise<ChatSessionsExportFile> {
  const store = await loadChatSessions();
  return {
    version: SESSIONS_EXPORT_VERSION,
    exportedAt: Date.now(),
    app: "ai-word-editor",
    store,
  };
}

export function downloadSessionsExport(data: ChatSessionsExportFile, filename?: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date(data.exportedAt).toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = filename || `ai-editor-sessions-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportAllSessionsToFile(): Promise<void> {
  const data = await buildSessionsExportFile();
  downloadSessionsExport(data);
}

export async function importSessionsFromFile(file: File): Promise<ImportSessionsResult> {
  const rawText = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("JSON 解析失败，请确认文件格式正确");
  }

  const incoming = parseExportPayload(parsed);
  const current = await loadChatSessions();
  const merged = mergeSessionStores(current, incoming);
  await saveChatSessions(merged.store);
  return merged;
}
