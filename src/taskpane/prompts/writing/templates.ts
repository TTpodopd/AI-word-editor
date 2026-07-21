import { AppSettings, WritingOutlineSection, WritingProject, WritingTemplate, createId } from "../../types";

export const BUILTIN_WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: "work-plan",
    name: "工作方案",
    description: "背景、目标、措施与保障",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "一、工作背景", brief: "说明立项依据、现状与必要性" },
      { level: 1, title: "二、工作目标", brief: "明确总体目标与分项目标" },
      { level: 1, title: "三、主要措施", brief: "列出关键任务与实施步骤" },
      { level: 2, title: "3.1 重点任务", brief: "细化核心工作项" },
      { level: 2, title: "3.2 时间安排", brief: "阶段划分与里程碑" },
      { level: 1, title: "四、保障措施", brief: "组织、资源与风险应对" },
    ],
    systemPrompt:
      "你是一位擅长撰写机关/企业工作方案的写作助手。语言正式、结构清晰，措施具体可执行，避免空泛表述。",
    sectionRules:
      "每节正文 300-600 字；一级标题下先写概述再展开；措施部分使用条目化表达；不要输出 Markdown 标记。",
  },
  {
    id: "report",
    name: "汇报材料",
    description: "概况、进展、问题与计划",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "一、基本情况", brief: "项目/工作概况与总体态势" },
      { level: 1, title: "二、主要进展", brief: "已完成工作与关键成果" },
      { level: 1, title: "三、存在问题", brief: "客观分析困难与不足" },
      { level: 1, title: "四、下步计划", brief: "近期安排与预期目标" },
    ],
    systemPrompt:
      "你是一位擅长撰写工作汇报材料的写作助手。突出数据与成果，问题分析客观，计划具体可行。",
    sectionRules:
      "每节正文 250-500 字；进展部分尽量量化；问题与计划一一对应；不要输出 Markdown 标记。",
  },
  {
    id: "proposal",
    name: "项目方案",
    description: "背景、需求、方案与实施计划",
    builtin: true,
    outlineSkeleton: [
      { level: 1, title: "一、项目背景", brief: "行业/业务背景与建设动因" },
      { level: 1, title: "二、需求分析", brief: "核心需求与建设目标" },
      { level: 1, title: "三、总体方案", brief: "架构思路与关键设计" },
      { level: 2, title: "3.1 技术路线", brief: "技术选型与实现路径" },
      { level: 2, title: "3.2 实施计划", brief: "阶段划分与交付物" },
      { level: 1, title: "四、预期成效", brief: "效益分析与风险评估" },
    ],
    systemPrompt:
      "你是一位擅长撰写项目/建设方案的写作助手。逻辑严谨，方案可落地，兼顾技术与管理视角。",
    sectionRules:
      "每节正文 350-700 字；方案部分层次清晰；实施计划含时间节点；不要输出 Markdown 标记。",
  },
];

export function getAllWritingTemplates(settings: AppSettings): WritingTemplate[] {
  const custom = settings.customWritingTemplates || [];
  return [...BUILTIN_WRITING_TEMPLATES, ...custom];
}

export function getWritingTemplateById(settings: AppSettings, templateId: string): WritingTemplate | undefined {
  return getAllWritingTemplates(settings).find((item) => item.id === templateId);
}

export function createEmptyWritingProject(templateId: string, topic = ""): WritingProject {
  const now = Date.now();
  return {
    templateId,
    topic,
    title: topic.trim() || "未命名写作",
    outline: [],
    currentSectionId: null,
    status: "setup",
    autoNextSection: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneTemplateOutline(template: WritingTemplate): WritingOutlineSection[] {
  return template.outlineSkeleton.map((item) => ({
    id: createId(),
    level: item.level,
    title: item.title,
    brief: item.brief,
    status: "pending" as const,
  }));
}

export function validateWritingTemplate(raw: unknown): WritingTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<WritingTemplate>;
  if (!item.id?.trim() || !item.name?.trim()) return null;
  if (!Array.isArray(item.outlineSkeleton) || item.outlineSkeleton.length === 0) return null;

  const outlineSkeleton = item.outlineSkeleton
    .map((section) => {
      if (!section || typeof section !== "object") return null;
      const level = section.level;
      if (level !== 1 && level !== 2 && level !== 3) return null;
      if (!section.title?.trim() || !section.brief?.trim()) return null;
      return { level, title: section.title.trim(), brief: section.brief.trim() };
    })
    .filter((section): section is WritingTemplate["outlineSkeleton"][number] => !!section);

  if (outlineSkeleton.length === 0) return null;

  return {
    id: item.id.trim(),
    name: item.name.trim(),
    description: item.description?.trim() || "",
    builtin: false,
    outlineSkeleton,
    systemPrompt: item.systemPrompt?.trim() || "你是一位专业的文档写作助手。",
    sectionRules: item.sectionRules?.trim() || "直接输出正文，不要 Markdown 标记。",
  };
}
