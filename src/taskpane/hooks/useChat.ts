import { useCallback, useEffect, useRef, useState } from "react";
import { ActionType, AppSettings, ChatMessage, ChatSession, getSystemPrompt, PendingAttachment, UIMessage } from "../types";
import { buildMessages, getActionById } from "../prompts/actions";
import { sendChatWithModel } from "../services/llmService";
import { augmentMessagesWithWebSearch } from "../services/webSearchService";
import { resolveModel } from "../services/modelService";
import {
  createEmptySession,
  ensureOfficeReady,
  ensureSessionOrder,
  getSessionDisplayTitle,
  loadChatSession,
  loadChatSessions,
  loadSettings,
  orderSessions,
  saveChatSessions,
} from "../services/storageService";
import { normalizeAssistantContent } from "../utils/textFormat";
import { ApplyMode, applyText, captureCursor, captureSelection, clearTrackedRange } from "../services/wordService";
import { hasImageAttachments, modelSupportsVision } from "../constants/modelCapabilities";
import {
  buildMultimodalUserContent,
  historyMessageToApiContent,
  toUiAttachments,
} from "../services/multimodalService";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildApiMessages(
  sessionMessages: UIMessage[],
  hasSelectionContext: boolean,
  appSettings: AppSettings
): ChatMessage[] {
  const system = getSystemPrompt(appSettings, hasSelectionContext);
  const history = sessionMessages.map((m) => ({
    role: m.role,
    content: historyMessageToApiContent(m),
  }));

  return [{ role: "system", content: system }, ...history];
}

function buildDisplayContent(text: string, attachments: PendingAttachment[]): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  if (attachments.some((item) => item.kind === "image")) return "请分析图片内容";
  if (attachments.some((item) => item.kind === "document")) return "请分析文档内容";
  return "";
}

function withSessionMeta(session: ChatSession): ChatSession {
  return {
    ...session,
    title: getSessionDisplayTitle(session),
    updatedAt: Date.now(),
  };
}

function applyOrderedStore(store: Awaited<ReturnType<typeof loadChatSessions>>) {
  const sessionOrder = ensureSessionOrder(store);
  const sessions = orderSessions(store.sessions, sessionOrder).map((session) => ({
    ...session,
    title: getSessionDisplayTitle(session),
  }));
  return { ...store, sessions, sessionOrder };
}

export function useChat(settings: AppSettings) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyMode, setApplyMode] = useState<ApplyMode>("insert");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const sessionRef = useRef<ChatSession | null>(null);
  const settingsRef = useRef<AppSettings>(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const getLatestSettings = useCallback(async () => {
    try {
      const stored = await loadSettings();
      settingsRef.current = stored;
      return stored;
    } catch {
      return settingsRef.current;
    }
  }, []);

  const applyStore = useCallback((store: Awaited<ReturnType<typeof loadChatSessions>>) => {
    const ordered = applyOrderedStore(store);
    const active =
      ordered.sessions.find((session) => session.id === ordered.activeSessionId) ??
      ordered.sessions[0] ??
      null;
    sessionRef.current = active;
    setSession(active);
    setSessions(ordered.sessions);
    setActiveSessionId(ordered.activeSessionId);
  }, []);

  useEffect(() => {
    let active = true;

    ensureOfficeReady().then(async () => {
      const store = await loadChatSessions();
      if (!active) return;
      applyStore(store);
    });

    return () => {
      active = false;
    };
  }, [applyStore]);

  const persistSession = useCallback(
    async (next: ChatSession) => {
      const withMeta = withSessionMeta(next);
      const store = await loadChatSessions();
      const idx = store.sessions.findIndex((s) => s.id === withMeta.id);

      if (idx >= 0) {
        store.sessions[idx] = withMeta;
      } else {
        store.sessions.unshift(withMeta);
        store.activeSessionId = withMeta.id;
      }

      store.activeSessionId = withMeta.id;
      store.sessionOrder = ensureSessionOrder(store);
      sessionRef.current = withMeta;
      setSession(withMeta);
      setSessions(orderSessions(store.sessions, store.sessionOrder));
      setActiveSessionId(withMeta.id);
      await saveChatSessions(store);
    },
    []
  );

  const flushCurrentSession = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;

    const store = await loadChatSessions();
    const withMeta = withSessionMeta(current);
    const idx = store.sessions.findIndex((s) => s.id === withMeta.id);

    if (idx >= 0) {
      store.sessions[idx] = withMeta;
    } else if (withMeta.messages.length > 0) {
      store.sessions.unshift(withMeta);
    }

    await saveChatSessions(store);
    store.sessionOrder = ensureSessionOrder(store);
    setSessions(orderSessions(store.sessions, store.sessionOrder));
  }, []);

  const getCurrentModel = useCallback(() => {
    return resolveModel(settings, settings.selectedModelId);
  }, [settings]);

  const appendMessages = useCallback(
    async (newMessages: UIMessage[]) => {
      const current = sessionRef.current ?? (await loadChatSession());
      await persistSession({
        ...current,
        messages: [...current.messages, ...newMessages],
      });
    },
    [persistSession]
  );

  const updateMessage = useCallback(
    async (id: string, patch: Partial<UIMessage>) => {
      const current = sessionRef.current;
      if (!current) return;

      await persistSession({
        ...current,
        messages: current.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      });
    },
    [persistSession]
  );

  const prepareContext = useCallback(async (selectedText?: string) => {
    let text = selectedText?.trim() || "";

    if (!text) {
      const captured = await captureSelection();
      if (captured.success) {
        text = captured.text;
      }
    }

    await captureCursor();
    setApplyMode("insert");
    return { text, applyMode: "insert" as ApplyMode };
  }, []);

  const requestAssistant = useCallback(
    async (
      assistantId: string,
      userContent: string,
      selectedText: string,
      priorMessages: UIMessage[],
      pendingAttachments: PendingAttachment[] = []
    ) => {
      const model = getCurrentModel();
      if (!model) {
        await updateMessage(assistantId, {
          status: "error",
          error: "请先在设置中选择并配置模型",
          content: "",
        });
        return;
      }

      if (hasImageAttachments(pendingAttachments) && !modelSupportsVision(model)) {
        await updateMessage(assistantId, {
          status: "error",
          error: `当前模型（${model.label}）不支持图片分析，请切换到 GPT-4o 等视觉模型`,
          content: "",
        });
        return;
      }

      const historyBeforeCurrent = priorMessages.filter((m) => m.id !== assistantId);
      const priorDone = historyBeforeCurrent.filter(
        (m) => m.status === "done" && (m.content.trim() || m.attachments?.length)
      );
      const lastUserMsg = priorDone[priorDone.length - 1];
      const historyForApi = lastUserMsg?.role === "user" ? priorDone.slice(0, -1) : priorDone;

      const latestSettings = await getLatestSettings();
      const apiMessages = buildApiMessages(historyForApi, !!selectedText, latestSettings);

      const instructionText = selectedText
        ? `指令：${userContent}\n\n选中文本：\n${selectedText}`
        : userContent;

      const lastUserContent = buildMultimodalUserContent(instructionText, pendingAttachments);

      apiMessages.push({ role: "user", content: lastUserContent });

      const { messages: finalMessages } = await augmentMessagesWithWebSearch(
        apiMessages,
        userContent,
        latestSettings.webSearch
      );

      const response = await sendChatWithModel(model, finalMessages);

      if (response.error) {
        await updateMessage(assistantId, {
          status: "error",
          error: response.error,
          content: "",
        });
      } else {
        await updateMessage(assistantId, {
          status: "done",
          content: normalizeAssistantContent(response.content),
          applyMode: "insert",
        });
      }
    },
    [getCurrentModel, getLatestSettings, updateMessage]
  );

  const sendMessage = useCallback(
    async (content: string, selectedText?: string, attachments: PendingAttachment[] = []) => {
      const trimmed = content.trim();
      if ((!trimmed && attachments.length === 0) || loading) return null;

      const model = getCurrentModel();
      if (hasImageAttachments(attachments) && model && !modelSupportsVision(model)) {
        return `当前模型（${model.label}）不支持图片分析，请切换到 GPT-4o 等视觉模型`;
      }

      setLoading(true);
      const { text, applyMode: mode } = await prepareContext(selectedText);

      const displayContent = buildDisplayContent(trimmed, attachments);

      const userMessage: UIMessage = {
        id: createId(),
        role: "user",
        content: displayContent,
        timestamp: Date.now(),
        status: "done",
        attachments: attachments.length ? toUiAttachments(attachments) : undefined,
      };

      const assistantMessage: UIMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "loading",
        applyMode: mode,
      };

      const current = sessionRef.current ?? (await loadChatSession());
      const nextMessages = [...current.messages, userMessage, assistantMessage];
      await persistSession({ ...current, messages: nextMessages });

      await requestAssistant(
        assistantMessage.id,
        displayContent,
        text,
        nextMessages,
        attachments
      );
      setLoading(false);
      return null;
    },
    [getCurrentModel, loading, persistSession, prepareContext, requestAssistant]
  );

  const runDirectAction = useCallback(
    async (actionId: ActionType, selectedText?: string): Promise<string | null> => {
      if (loading) return "正在处理中，请稍候";

      const action = getActionById(actionId);
      if (!action) return null;

      const captured = await captureSelection();
      const text = captured.text || selectedText?.trim() || "";
      if (!captured.success || !text) {
        return "请先在文档中选中要处理的文本";
      }

      const model = getCurrentModel();
      if (!model) {
        return "请先在设置中选择并配置模型";
      }

      setLoading(true);
      try {
        const latestSettings = await getLatestSettings();
        const apiMessages = buildMessages(action, text, latestSettings);
        const response = await sendChatWithModel(model, apiMessages);

        if (response.error) {
          clearTrackedRange();
          return response.error;
        }

        const result = await applyText(normalizeAssistantContent(response.content));
        clearTrackedRange();

        if (!result.success) {
          return result.error || "写入文档失败";
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [getCurrentModel, getLatestSettings, loading]
  );

  const runAction = useCallback(
    async (actionId: ActionType, selectedText?: string) => {
      if (loading) return;

      const action = getActionById(actionId);
      if (!action) return;

      const captured = await captureSelection();
      const text = selectedText?.trim() || captured.text;
      if (!text) {
        await appendMessages([
          {
            id: createId(),
            role: "assistant",
            content: "",
            timestamp: Date.now(),
            status: "error",
            error: "请先在文档中选中要处理的文本",
          },
        ]);
        return;
      }

      setLoading(true);
      await captureCursor();
      setApplyMode("insert");

      const userMessage: UIMessage = {
        id: createId(),
        role: "user",
        content: action.slashCommand,
        timestamp: Date.now(),
        status: "done",
      };

      const assistantMessage: UIMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "loading",
        applyMode: "insert",
      };

      const current = sessionRef.current ?? (await loadChatSession());
      const nextMessages = [...current.messages, userMessage, assistantMessage];
      await persistSession({ ...current, messages: nextMessages });

      const model = getCurrentModel();
      if (!model) {
        await updateMessage(assistantMessage.id, {
          status: "error",
          error: "请先在设置中选择并配置模型",
        });
        setLoading(false);
        return;
      }

      const latestSettings = await getLatestSettings();
      const apiMessages = buildMessages(action, text, latestSettings);
      const response = await sendChatWithModel(model, apiMessages);

      if (response.error) {
        await updateMessage(assistantMessage.id, { status: "error", error: response.error });
      } else {
        await updateMessage(assistantMessage.id, {
          status: "done",
          content: normalizeAssistantContent(response.content),
          applyMode: "insert",
        });
      }
      setLoading(false);
    },
    [appendMessages, getCurrentModel, getLatestSettings, loading, persistSession, updateMessage]
  );

  const regenerateMessage = useCallback(
    async (assistantId: string) => {
      const current = sessionRef.current;
      if (!current || loading) return;

      const assistantIndex = current.messages.findIndex((m) => m.id === assistantId);
      if (assistantIndex <= 0) return;

      const userMessage = current.messages
        .slice(0, assistantIndex)
        .reverse()
        .find((m) => m.role === "user");
      if (!userMessage) return;

      setLoading(true);
      await updateMessage(assistantId, {
        content: "",
        status: "loading",
        error: undefined,
      });

      const { text } = await prepareContext();
      await requestAssistant(assistantId, userMessage.content, text, current.messages);
      setLoading(false);
    },
    [loading, prepareContext, requestAssistant, updateMessage]
  );

  const startEditMessage = useCallback((messageId: string) => {
    setEditingMessageId(messageId);
  }, []);

  const cancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (loading) return;

      const current = sessionRef.current;
      if (!current) return;

      const msgIndex = current.messages.findIndex((m) => m.id === messageId);
      if (msgIndex < 0) return;

      const target = current.messages[msgIndex];
      if (target.status === "loading") return;

      let nextMessages: UIMessage[];
      if (target.role === "user") {
        const next = current.messages[msgIndex + 1];
        const removeCount = next?.role === "assistant" ? 2 : 1;
        nextMessages = [
          ...current.messages.slice(0, msgIndex),
          ...current.messages.slice(msgIndex + removeCount),
        ];
      } else {
        nextMessages = [
          ...current.messages.slice(0, msgIndex),
          ...current.messages.slice(msgIndex + 1),
        ];
      }

      if (editingMessageId === messageId) {
        setEditingMessageId(null);
      }

      await persistSession({ ...current, messages: nextMessages });
    },
    [editingMessageId, loading, persistSession]
  );

  const editAndResend = useCallback(
    async (messageId: string, newContent: string, selectedText?: string) => {
      const trimmed = newContent.trim();
      if (!trimmed || loading) return;

      const current = sessionRef.current;
      if (!current) return;

      const msgIndex = current.messages.findIndex((m) => m.id === messageId);
      if (msgIndex < 0 || current.messages[msgIndex].role !== "user") return;

      setEditingMessageId(null);
      setLoading(true);

      const { text, applyMode: mode } = await prepareContext(selectedText);

      const kept = current.messages.slice(0, msgIndex);
      const updatedUser: UIMessage = {
        ...current.messages[msgIndex],
        content: trimmed,
        timestamp: Date.now(),
        status: "done",
      };

      const assistantMessage: UIMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "loading",
        applyMode: mode,
      };

      const nextMessages = [...kept, updatedUser, assistantMessage];
      await persistSession({ ...current, messages: nextMessages });

      await requestAssistant(assistantMessage.id, trimmed, text, nextMessages);
      setLoading(false);
    },
    [loading, persistSession, prepareContext, requestAssistant]
  );

  const switchSession = useCallback(
    async (sessionId: string) => {
      if (loading || sessionId === sessionRef.current?.id) return;

      await flushCurrentSession();
      const store = await loadChatSessions();
      const target = store.sessions.find((s) => s.id === sessionId);
      if (!target) return;

      store.activeSessionId = sessionId;
      setEditingMessageId(null);
      setApplyMode("insert");

      sessionRef.current = target;
      setSession(target);
      store.sessionOrder = ensureSessionOrder(store);
      setSessions(orderSessions(store.sessions, store.sessionOrder));
      setActiveSessionId(sessionId);
      await saveChatSessions(store);
    },
    [flushCurrentSession, loading]
  );

  const newConversation = useCallback(async () => {
    const current = sessionRef.current;
    if (current && current.messages.length === 0) return;

    const store = await loadChatSessions();

    if (current) {
      const withMeta = withSessionMeta(current);
      const idx = store.sessions.findIndex((s) => s.id === withMeta.id);
      if (idx >= 0) {
        store.sessions[idx] = withMeta;
      } else {
        store.sessions.unshift(withMeta);
      }
    }

    const fresh = createEmptySession();
    store.sessions.unshift(fresh);
    store.activeSessionId = fresh.id;
    store.sessions = store.sessions.filter(
      (session) => session.messages.length > 0 || session.id === fresh.id
    );
    store.sessionOrder = [fresh.id, ...ensureSessionOrder(store).filter((id) => id !== fresh.id)];

    setEditingMessageId(null);
    setApplyMode("insert");

    sessionRef.current = fresh;
    setSession(fresh);
    setSessions(orderSessions(store.sessions, store.sessionOrder));
    setActiveSessionId(fresh.id);
    await saveChatSessions(store);
  }, []);

  const renameSession = useCallback(async (sessionId: string, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed) return;

    const store = await loadChatSessions();
    const idx = store.sessions.findIndex((session) => session.id === sessionId);
    if (idx < 0) return;

    const updated: ChatSession = {
      ...store.sessions[idx],
      customTitle: trimmed,
      title: trimmed,
      updatedAt: Date.now(),
    };
    store.sessions[idx] = updated;

    if (sessionRef.current?.id === sessionId) {
      sessionRef.current = updated;
      setSession(updated);
    }

    store.sessionOrder = ensureSessionOrder(store);
    setSessions(orderSessions(store.sessions, store.sessionOrder));
    await saveChatSessions(store);
  }, []);

  const reorderSessions = useCallback(async (orderedIds: string[]) => {
    setSessions((prev) => orderSessions(prev, orderedIds));

    const store = await loadChatSessions();
    const validIds = new Set(store.sessions.map((session) => session.id));
    const nextOrder = orderedIds.filter((id) => validIds.has(id));
    store.sessions.forEach((session) => {
      if (!nextOrder.includes(session.id)) {
        nextOrder.push(session.id);
      }
    });

    store.sessionOrder = nextOrder;
    setSessions(orderSessions(store.sessions, store.sessionOrder));
    await saveChatSessions(store);
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (loading) return;

      const store = await loadChatSessions();
      if (store.sessions.length <= 1) return;

      await flushCurrentSession();
      const refreshed = await loadChatSessions();
      refreshed.sessions = refreshed.sessions.filter((session) => session.id !== sessionId);
      refreshed.sessionOrder = ensureSessionOrder(refreshed).filter((id) => id !== sessionId);

      if (refreshed.activeSessionId === sessionId) {
        const next = refreshed.sessions[0] ?? createEmptySession();
        if (!refreshed.sessions.length) {
          refreshed.sessions = [next];
        }
        refreshed.activeSessionId = next.id;
        sessionRef.current = next;
        setSession(next);
        setEditingMessageId(null);
      }

      setSessions(orderSessions(refreshed.sessions, refreshed.sessionOrder));
      setActiveSessionId(refreshed.activeSessionId);
      await saveChatSessions(refreshed);
    },
    [flushCurrentSession, loading]
  );

  const messages = session?.messages ?? [];

  return {
    messages,
    sessions,
    activeSessionId,
    loading,
    applyMode,
    editingMessageId,
    sendMessage,
    runAction,
    runDirectAction,
    regenerateMessage,
    editAndResend,
    startEditMessage,
    cancelEditMessage,
    deleteMessage,
    switchSession,
    renameSession,
    reorderSessions,
    deleteSession,
    newConversation,
    hasMessages: messages.length > 0,
  };
}
