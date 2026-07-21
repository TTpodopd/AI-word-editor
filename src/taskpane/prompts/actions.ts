import { ActionType, AppSettings, getSystemPrompt } from "../types";
import {
  detectSelectionContentKind,
  SelectionContentKind,
} from "../utils/selectionContentType";

export interface ActionPrompt {
  id: ActionType;
  label: string;
  slashCommand: string;
  systemPrompt: string;
  userPromptTemplate: (text: string) => string;
  contentKinds: SelectionContentKind[];
}

export const ACTION_PROMPTS: ActionPrompt[] = [
  {
    id: "summarize",
    label: "汇总",
    slashCommand: "/汇总",
    contentKinds: ["text"],
    systemPrompt:
      "你是一位专业的文档编辑助手。请对用户提供的文本进行汇总，保留核心信息，输出简洁摘要。不要添加原文中没有的内容。直接输出汇总结果，不要解释过程。",
    userPromptTemplate: (text) => `请汇总以下文本：\n\n${text}`,
  },
  {
    id: "simplify",
    label: "精简",
    slashCommand: "/精简",
    contentKinds: ["text"],
    systemPrompt:
      "你是一位专业的文档编辑助手。请精简用户提供的文本，压缩篇幅，删除冗余表达，但保持原意不变。直接输出精简后的文本，不要解释过程。",
    userPromptTemplate: (text) => `请精简以下文本：\n\n${text}`,
  },
  {
    id: "expand",
    label: "扩写",
    slashCommand: "/扩写",
    contentKinds: ["text"],
    systemPrompt:
      "你是一位专业的文档编辑助手。请扩写用户提供的文本，补充合理的细节与论述，保持与原文一致的风格和语气。直接输出扩写后的文本，不要解释过程。",
    userPromptTemplate: (text) => `请扩写以下文本：\n\n${text}`,
  },
  {
    id: "polish",
    label: "润色",
    slashCommand: "/润色",
    contentKinds: ["text"],
    systemPrompt:
      "你是一位专业的文档编辑助手。请润色用户提供的文本，改善表达流畅度和专业性，但不改变事实内容。直接输出润色后的文本，不要解释过程。",
    userPromptTemplate: (text) => `请润色以下文本：\n\n${text}`,
  },
  {
    id: "proofread",
    label: "校对",
    slashCommand: "/校对",
    contentKinds: ["text"],
    systemPrompt:
      "你是一位专业的文字校对助手。请对用户提供的文本进行校对，仅修正标点符号错误和错字（含同音字、形近字误用）。必须保留原文用词、句式、段落结构和事实内容，不得改写、润色、增删或重组句子。如无错误则原样输出。直接输出校对后的文本，不要解释修改过程，不要标注修改说明。",
    userPromptTemplate: (text) => `请校对以下文本，仅修正标点符号和错字：\n\n${text}`,
  },
  {
    id: "translate",
    label: "翻译",
    slashCommand: "/翻译",
    contentKinds: ["text"],
    systemPrompt:
      "你是一位专业的翻译助手。请将用户提供的文本翻译为英文（如果原文是英文则翻译为中文）。保持专业、流畅。直接输出翻译结果，不要解释过程。",
    userPromptTemplate: (text) => `请翻译以下文本：\n\n${text}`,
  },
  {
    id: "fillForm",
    label: "填表",
    slashCommand: "/填表",
    contentKinds: ["text"],
    systemPrompt: "",
    userPromptTemplate: (text) => text,
  },
  {
    id: "explainCode",
    label: "解释",
    slashCommand: "/解释",
    contentKinds: ["code"],
    systemPrompt:
      "你是一位资深程序员。请用清晰的中文解释用户提供的代码：说明整体作用、关键逻辑、输入输出与注意事项。可分段或条列，但不要重复粘贴完整代码。",
    userPromptTemplate: (text) => `请解释以下代码：\n\n${text}`,
  },
  {
    id: "expandCode",
    label: "扩写",
    slashCommand: "/扩写",
    contentKinds: ["code"],
    systemPrompt:
      "你是一位资深程序员。请扩写用户提供的代码，补充必要的实现细节、边界处理或辅助逻辑，保持原有功能与风格一致。直接输出扩写后的完整代码，不要解释过程。",
    userPromptTemplate: (text) => `请扩写以下代码：\n\n${text}`,
  },
  {
    id: "simplifyCode",
    label: "删减",
    slashCommand: "/删减",
    contentKinds: ["code"],
    systemPrompt:
      "你是一位资深程序员。请精简用户提供的代码，删除冗余逻辑与重复实现，在保持功能不变的前提下让代码更短更清晰。直接输出删减后的完整代码，不要解释过程。",
    userPromptTemplate: (text) => `请删减以下代码：\n\n${text}`,
  },
  {
    id: "addComments",
    label: "注释",
    slashCommand: "/注释",
    contentKinds: ["code"],
    systemPrompt:
      "你是一位资深程序员。请为用户提供的代码添加恰当的中文注释，说明关键逻辑与参数含义，保持原有代码结构与行为不变。直接输出带注释的完整代码。",
    userPromptTemplate: (text) => `请为以下代码添加注释：\n\n${text}`,
  },
  {
    id: "optimizeCode",
    label: "优化",
    slashCommand: "/优化",
    contentKinds: ["code"],
    systemPrompt:
      "你是一位资深程序员。请优化用户提供的代码，在保持功能不变的前提下提升可读性、性能或结构。直接输出优化后的完整代码，不要解释过程，不要输出 JSON 或表单字段。",
    userPromptTemplate: (text) => `请优化以下代码：\n\n${text}`,
  },
];

const CODE_ACTION_IDS = new Set<ActionType>([
  "explainCode",
  "expandCode",
  "simplifyCode",
  "addComments",
  "optimizeCode",
]);

export function isCodeActionId(id?: ActionType): boolean {
  return !!id && CODE_ACTION_IDS.has(id);
}

export function getActionsForContentKind(kind: SelectionContentKind): ActionPrompt[] {
  return ACTION_PROMPTS.filter((action) => action.contentKinds.includes(kind));
}

export function getActionsForSelection(text: string, hasSelection: boolean): ActionPrompt[] {
  if (!hasSelection) {
    return getActionsForContentKind("text");
  }
  return getActionsForContentKind(detectSelectionContentKind(text));
}

export function getActionById(id: ActionType): ActionPrompt | undefined {
  return ACTION_PROMPTS.find((a) => a.id === id);
}

export function getActionBySlashCommand(
  cmd: string,
  selectionText = "",
  hasSelection = false
): ActionPrompt | undefined {
  if (hasSelection) {
    const kind = detectSelectionContentKind(selectionText);
    const contextual = ACTION_PROMPTS.find(
      (action) => action.slashCommand === cmd && action.contentKinds.includes(kind)
    );
    if (contextual) return contextual;
  }
  return ACTION_PROMPTS.find((action) => action.slashCommand === cmd);
}

export function buildActionSystemPrompt(settings: AppSettings, action: ActionPrompt): string {
  const basePrompt = getSystemPrompt(settings, true);
  return `${basePrompt}\n\n【当前任务】${action.systemPrompt}`;
}

export function buildMessages(
  action: ActionPrompt,
  text: string,
  settings: AppSettings,
  customInstruction?: string
): { role: "system" | "user"; content: string }[] {
  if (customInstruction) {
    return [
      {
        role: "system",
        content: getSystemPrompt(settings, true),
      },
      {
        role: "user",
        content: `指令：${customInstruction}\n\n文本：\n${text}`,
      },
    ];
  }
  return [
    { role: "system", content: buildActionSystemPrompt(settings, action) },
    { role: "user", content: action.userPromptTemplate(text) },
  ];
}
