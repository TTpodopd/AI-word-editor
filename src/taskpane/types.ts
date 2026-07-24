import type { ChatBottomActionId } from "./constants/chatBottomActions";
import { DEFAULT_CHAT_BOTTOM_ACTION_ORDER } from "./constants/chatBottomActions";
import type { ThemeColorId } from "./constants/themeColors";
import { DEFAULT_THEME_COLOR_ID } from "./constants/themeColors";
import type { OutputStyleId } from "./prompts/outputStylePresets";
import { DEFAULT_OUTPUT_STYLE_ID, appendOutputStylePrompt } from "./prompts/outputStylePresets";

export type LLMProvider = "deepseek" | "openai" | "qwen" | "custom";

export type ActionType =
  | "summarize"
  | "simplify"
  | "expand"
  | "polish"
  | "proofread"
  | "translate"
  | "explainCode"
  | "expandCode"
  | "simplifyCode"
  | "addComments"
  | "optimizeCode"
  | "custom";

export type AppView = "chat" | "writing" | "tools" | "settings";

export type WritingProjectStatus = "setup" | "outline" | "writing" | "review" | "done";

export type WritingSectionStatus = "pending" | "generating" | "done";

export interface WritingOutlineSection {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  brief: string;
  content?: string;
  status?: WritingSectionStatus;
}

export interface WritingTemplateSkeleton {
  level: 1 | 2 | 3;
  title: string;
  brief: string;
}

/** 内置/自定义写作模板所属分类（不含「全部」） */
export type WritingTemplateCategoryId =
  | "plan"
  | "report"
  | "decision"
  | "notice"
  | "request"
  | "letter"
  | "speech"
  | "custom";

export interface WritingTemplateCategory {
  id: WritingTemplateCategoryId;
  label: string;
  hint: string;
}

export interface WritingTemplate {
  id: string;
  name: string;
  description: string;
  category?: WritingTemplateCategoryId;
  builtin?: boolean;
  outlineSkeleton: WritingTemplateSkeleton[];
  systemPrompt: string;
  sectionRules: string;
}

export interface WritingProject {
  templateId: string;
  topic: string;
  title: string;
  extraNotes?: string;
  outline: WritingOutlineSection[];
  currentSectionId: string | null;
  status: WritingProjectStatus;
  autoNextSection: boolean;
  importedFromDocument?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentHeading {
  title: string;
  level: 1 | 2 | 3;
}

export interface ModelConfig {
  id: string;
  provider: LLMProvider;
  model: string;
  label: string;
  customProviderId?: string;
  apiBaseUrl?: string;
}

export interface CustomModel {
  id: string;
  modelId: string;
  nickname: string;
}

export interface CustomProvider {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  models: CustomModel[];
}

export interface ResolvedModel {
  id: string;
  provider: LLMProvider;
  model: string;
  label: string;
  apiKey: string;
  apiBaseUrl?: string;
}

export interface ChatMessageContentPart {
  type: "text";
  text: string;
}

export interface ChatMessageImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type ChatMessageContent = string | Array<ChatMessageContentPart | ChatMessageImagePart>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatMessageContent;
}

export interface MessageAttachment {
  id: string;
  kind: "image" | "document";
  name: string;
  previewUrl?: string;
  textPreview?: string;
  textContent?: string;
  imageDataUrl?: string;
}

export interface PendingAttachment {
  id: string;
  kind: "image" | "document";
  name: string;
  mimeType: string;
  imageDataUrl?: string;
  textContent?: string;
  previewUrl?: string;
  textPreview?: string;
}

export interface MessageSearchResult {
  title: string;
  url: string;
  content?: string;
}

export interface MessageSearchInfo {
  query: string;
  results: MessageSearchResult[];
  error?: string;
}

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: MessageAttachment[];
  applyMode?: "replace" | "insert";
  sourceText?: string;
  actionLabel?: string;
  actionId?: ActionType;
  searchInfo?: MessageSearchInfo;
  status?: "loading" | "error" | "done";
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  customTitle?: string;
  messages: UIMessage[];
  writingProject?: WritingProject | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionsStore {
  activeSessionId: string;
  sessions: ChatSession[];
  sessionOrder?: string[];
}

export interface SelectionState {
  hasSelection: boolean;
  text: string;
  charCount: number;
}

export interface SystemPromptSettings {
  withSelection: string;
  withoutSelection: string;
}

export type WebSearchProvider = "tavily";

export interface WebSearchSettings {
  enabled: boolean;
  provider: WebSearchProvider;
  apiKey: string;
  excludeDomains: string;
  resultLimit: number;
  systemPrompt: string;
}

export interface AppSettings {
  apiKeys: Record<Exclude<LLMProvider, "custom">, string>;
  proxyAccessToken?: string;
  selectedModelId: string;
  customProviders: CustomProvider[];
  hiddenModelIds: string[];
  systemPrompts: SystemPromptSettings;
  themeColorId: ThemeColorId;
  webSearch: WebSearchSettings;
  quickApplyEnabled?: boolean;
  customWritingTemplates?: WritingTemplate[];
  /** 已从列表隐藏的内置模板 id */
  hiddenWritingTemplateIds?: string[];
  /** 对话输出风格 */
  outputStyleId?: OutputStyleId;
  /** 底部工具栏功能项顺序 */
  chatBottomActionOrder?: ChatBottomActionId[];
}

export const BUILTIN_MODEL_OPTIONS: ModelConfig[] = [
  { id: "deepseek-r1", provider: "deepseek", model: "deepseek-reasoner", label: "DeepSeek R1" },
  { id: "deepseek-chat", provider: "deepseek", model: "deepseek-chat", label: "DeepSeek Chat" },
  { id: "gpt-4o", provider: "openai", model: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "qwen-plus", provider: "qwen", model: "qwen-plus", label: "通义千问 Plus" },
  { id: "qwen-turbo", provider: "qwen", model: "qwen-turbo", label: "通义千问 Turbo" },
];

export const DEFAULT_SYSTEM_PROMPTS: SystemPromptSettings = {
  withSelection:
    "你是一位专业的 Word 文档编辑助手。用户可能会提供选中的文档文本，请根据指令处理或回答问题。处理文档时直接输出结果，对话时自然回复。支持多轮对话。输出时不要使用空行，段落之间仅用单个换行分隔。输出纯文本，不要使用 Markdown 格式（如 **、_、#、反引号等），尤其不要在字母、希腊字母或公式变量前添加 _ 或 *。",
  withoutSelection:
    "你是一位专业的 Word 文档写作助手。帮助用户生成、润色、讨论文档内容。直接输出可用内容，对话时自然回复。支持多轮对话。输出时不要使用空行，段落之间仅用单个换行分隔。输出纯文本，不要使用 Markdown 格式（如 **、_、#、反引号等），尤其不要在字母、希腊字母或公式变量前添加 _ 或 *。",
};

export const DEFAULT_WEB_SEARCH: WebSearchSettings = {
  enabled: false,
  provider: "tavily",
  apiKey: "",
  excludeDomains: "",
  resultLimit: 8,
  systemPrompt:
    "你拥有通过联网搜索获取实时信息的能力。规则：\n- 优先根据提供的搜索结果回答，并尽量标注来源\n- 若搜索结果不足以回答问题，可结合已有知识补充，并说明不确定之处\n- 不要编造搜索结果中不存在的事实",
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: { deepseek: "", openai: "", qwen: "" },
  proxyAccessToken: "",
  selectedModelId: "deepseek-r1",
  customProviders: [],
  hiddenModelIds: [],
  systemPrompts: { ...DEFAULT_SYSTEM_PROMPTS },
  themeColorId: DEFAULT_THEME_COLOR_ID,
  webSearch: { ...DEFAULT_WEB_SEARCH },
  quickApplyEnabled: false,
  customWritingTemplates: [],
  hiddenWritingTemplateIds: [],
  outputStyleId: DEFAULT_OUTPUT_STYLE_ID,
  chatBottomActionOrder: [...DEFAULT_CHAT_BOTTOM_ACTION_ORDER],
};

export const SYSTEM_PROMPT_WITH_SELECTION = DEFAULT_SYSTEM_PROMPTS.withSelection;

export const SYSTEM_PROMPT_WITHOUT_SELECTION = DEFAULT_SYSTEM_PROMPTS.withoutSelection;

export function getSystemPrompt(settings: AppSettings, hasSelection: boolean): string {
  const prompts = settings.systemPrompts || DEFAULT_SYSTEM_PROMPTS;
  const text = hasSelection ? prompts.withSelection : prompts.withoutSelection;
  const fallback = hasSelection
    ? DEFAULT_SYSTEM_PROMPTS.withSelection
    : DEFAULT_SYSTEM_PROMPTS.withoutSelection;
  const base = text.trim() || fallback;
  return appendOutputStylePrompt(base, settings.outputStyleId, hasSelection);
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
