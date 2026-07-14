import { ActionType, AppSettings, getSystemPrompt } from "../types";

export interface ActionPrompt {
  id: ActionType;
  label: string;
  slashCommand: string;
  systemPrompt: string;
  userPromptTemplate: (text: string) => string;
}

export const ACTION_PROMPTS: ActionPrompt[] = [
  {
    id: "summarize",
    label: "汇总",
    slashCommand: "/汇总",
    systemPrompt:
      "你是一位专业的文档编辑助手。请对用户提供的文本进行汇总，保留核心信息，输出简洁摘要。不要添加原文中没有的内容。直接输出汇总结果，不要解释过程。",
    userPromptTemplate: (text) => `请汇总以下文本：\n\n${text}`,
  },
  {
    id: "simplify",
    label: "精简",
    slashCommand: "/精简",
    systemPrompt:
      "你是一位专业的文档编辑助手。请精简用户提供的文本，压缩篇幅，删除冗余表达，但保持原意不变。直接输出精简后的文本，不要解释过程。",
    userPromptTemplate: (text) => `请精简以下文本：\n\n${text}`,
  },
  {
    id: "expand",
    label: "扩写",
    slashCommand: "/扩写",
    systemPrompt:
      "你是一位专业的文档编辑助手。请扩写用户提供的文本，补充合理的细节与论述，保持与原文一致的风格和语气。直接输出扩写后的文本，不要解释过程。",
    userPromptTemplate: (text) => `请扩写以下文本：\n\n${text}`,
  },
  {
    id: "polish",
    label: "润色",
    slashCommand: "/润色",
    systemPrompt:
      "你是一位专业的文档编辑助手。请润色用户提供的文本，改善表达流畅度和专业性，但不改变事实内容。直接输出润色后的文本，不要解释过程。",
    userPromptTemplate: (text) => `请润色以下文本：\n\n${text}`,
  },
  {
    id: "translate",
    label: "翻译",
    slashCommand: "/翻译",
    systemPrompt:
      "你是一位专业的翻译助手。请将用户提供的文本翻译为英文（如果原文是英文则翻译为中文）。保持专业、流畅。直接输出翻译结果，不要解释过程。",
    userPromptTemplate: (text) => `请翻译以下文本：\n\n${text}`,
  },
];

export function getActionById(id: ActionType): ActionPrompt | undefined {
  return ACTION_PROMPTS.find((a) => a.id === id);
}

export function getActionBySlashCommand(cmd: string): ActionPrompt | undefined {
  return ACTION_PROMPTS.find((a) => a.slashCommand === cmd);
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
