export type ChatBottomActionId = "webSearch" | "outputStyle" | "settings";

export const DEFAULT_CHAT_BOTTOM_ACTION_ORDER: ChatBottomActionId[] = [
  "webSearch",
  "outputStyle",
  "settings",
];

const LEGACY_BOTTOM_ACTION_IDS = new Set(["newChat", "sessions"]);
const ALL_BOTTOM_ACTION_IDS = new Set<string>(DEFAULT_CHAT_BOTTOM_ACTION_ORDER);

export function resolveChatBottomActionOrder(value: unknown): ChatBottomActionId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CHAT_BOTTOM_ACTION_ORDER];
  }

  const seen = new Set<ChatBottomActionId>();
  const resolved: ChatBottomActionId[] = [];

  for (const item of value) {
    if (
      typeof item === "string" &&
      !LEGACY_BOTTOM_ACTION_IDS.has(item) &&
      ALL_BOTTOM_ACTION_IDS.has(item)
    ) {
      const id = item as ChatBottomActionId;
      if (!seen.has(id)) {
        seen.add(id);
        resolved.push(id);
      }
    }
  }

  for (const id of DEFAULT_CHAT_BOTTOM_ACTION_ORDER) {
    if (!seen.has(id)) {
      resolved.push(id);
    }
  }

  return resolved;
}
