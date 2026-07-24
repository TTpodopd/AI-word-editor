import {
  AppSettings,
  WritingOutlineSection,
  WritingProject,
  WritingTemplate,
  WritingTemplateCategory,
  WritingTemplateCategoryId,
  createId,
} from "../../types";
import { OFFICIAL_WRITING_TEMPLATES } from "./officialDocumentTemplates";

export const WRITING_TEMPLATE_CATEGORIES: WritingTemplateCategory[] = [
  { id: "decision", label: "决议决定", hint: "决议、决定" },
  { id: "notice", label: "公告通告通知", hint: "公告、通告、通知" },
  { id: "request", label: "请示报告批复", hint: "请示、报告、批复、意见" },
  { id: "letter", label: "函件纪要", hint: "函、纪要" },
  { id: "plan", label: "方案规划", hint: "工作方案、项目方案、实施方案" },
  { id: "report", label: "汇报总结", hint: "工作汇报、总结、述职" },
  { id: "speech", label: "讲话发言", hint: "讲话稿、发言材料" },
  { id: "custom", label: "自定义", hint: "导入或保存的模板" },
];

export const BUILTIN_WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: "work-plan",
    name: "工作方案",
    description: "背景、目标、措施与保障",
    category: "plan",
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
    category: "report",
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
    category: "plan",
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
  ...OFFICIAL_WRITING_TEMPLATES,
];

export function getAllWritingTemplates(settings: AppSettings): WritingTemplate[] {
  const hidden = new Set(settings.hiddenWritingTemplateIds || []);
  const builtin = BUILTIN_WRITING_TEMPLATES.filter((item) => !hidden.has(item.id));
  const custom = settings.customWritingTemplates || [];
  return [...builtin, ...custom];
}

export function getWritingTemplateCategory(template: WritingTemplate): WritingTemplateCategoryId {
  if (!template.builtin) return "custom";
  return template.category || "plan";
}

export function getWritingTemplateCategoryLabel(categoryId: WritingTemplateCategoryId): string {
  return WRITING_TEMPLATE_CATEGORIES.find((item) => item.id === categoryId)?.label || categoryId;
}

export function filterWritingTemplates(
  templates: WritingTemplate[],
  options: { categoryId?: WritingTemplateCategoryId | "all"; query?: string }
): WritingTemplate[] {
  const normalizedQuery = options.query?.trim().toLowerCase() || "";
  return templates.filter((template) => {
    const category = getWritingTemplateCategory(template);
    if (options.categoryId && options.categoryId !== "all" && category !== options.categoryId) {
      return false;
    }
    if (!normalizedQuery) return true;
    const haystack = `${template.name} ${template.description} ${getWritingTemplateCategoryLabel(category)}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function getActiveWritingTemplateCategories(templates: WritingTemplate[]): WritingTemplateCategory[] {
  const activeIds = new Set(templates.map((template) => getWritingTemplateCategory(template)));
  return WRITING_TEMPLATE_CATEGORIES.filter((category) => activeIds.has(category.id));
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

export function templateSkeletonToOutline(skeleton: WritingTemplate["outlineSkeleton"]): WritingOutlineSection[] {
  return skeleton.map((item) => ({
    id: createId(),
    level: item.level,
    title: item.title,
    brief: item.brief,
    status: "pending" as const,
  }));
}

export function outlineToTemplateSkeleton(sections: WritingOutlineSection[]): WritingTemplate["outlineSkeleton"] {
  return sections
    .map(({ level, title, brief }) => ({
      level,
      title: title.trim(),
      brief: brief.trim(),
    }))
    .filter((item) => item.title && item.brief);
}

export function duplicateWritingTemplate(template: WritingTemplate, overrides?: Partial<WritingTemplate>): WritingTemplate {
  return {
    ...template,
    ...overrides,
    id: overrides?.id || `custom-${Date.now()}`,
    builtin: false,
    category: overrides?.category || template.category || "custom",
    outlineSkeleton: (overrides?.outlineSkeleton || template.outlineSkeleton).map((item) => ({ ...item })),
  };
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

  const category =
    item.category && WRITING_TEMPLATE_CATEGORIES.some((entry) => entry.id === item.category)
      ? item.category
      : undefined;

  return {
    id: item.id.trim(),
    name: item.name.trim(),
    description: item.description?.trim() || "",
    category,
    builtin: false,
    outlineSkeleton,
    systemPrompt: item.systemPrompt?.trim() || "你是一位专业的文档写作助手。",
    sectionRules: item.sectionRules?.trim() || "直接输出正文，不要 Markdown 标记。",
  };
}
