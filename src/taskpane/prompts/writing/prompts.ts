import { AppSettings, DocumentHeading, WritingOutlineSection, WritingProject, WritingTemplate } from "../../types";
import { buildOutlineTitlesList, summarizeSectionContent } from "./outlineParser";

export function buildOutlineGenerationPrompt(
  template: WritingTemplate,
  topic: string,
  extraNotes?: string
): { system: string; user: string } {
  const skeleton = template.outlineSkeleton
    .map((item) => `- [L${item.level}] ${item.title}：${item.brief}`)
    .join("\n");

  const system = `${template.systemPrompt}

【任务】根据用户主题生成文档大纲。
【输出要求】
- 仅输出 JSON，不要任何解释或 Markdown
- JSON 格式：
{
  "title": "文档标题",
  "sections": [
    { "id": "唯一字符串", "level": 1, "title": "章节标题", "brief": "本节写作要点" }
  ]
}
- level 只能是 1、2 或 3
- 章节数量 4-10 个，可参照模板骨架调整
- brief 一句话说明该节写什么`;

  const user = `主题：${topic.trim()}
模板：${template.name}
模板骨架参考：
${skeleton}
${extraNotes?.trim() ? `\n补充要求：${extraNotes.trim()}` : ""}`;

  return { system, user };
}

export function buildSectionWritingPrompt(
  settings: AppSettings,
  template: WritingTemplate,
  project: WritingProject,
  section: WritingOutlineSection
): { system: string; user: string } {
  const sectionIndex = project.outline.findIndex((item) => item.id === section.id);
  const previousSection = sectionIndex > 0 ? project.outline[sectionIndex - 1] : null;
  const previousSummary = previousSection?.content
    ? summarizeSectionContent(previousSection.content)
    : previousSection?.brief || "（无）";

  const system = `${template.systemPrompt}

【写作规则】
${template.sectionRules}

【当前文档】
标题：${project.title}
主题：${project.topic}

【输出要求】
- 只输出「${section.title}」的正文内容
- 不要重复输出章节标题
- 不要输出 Markdown 标记（如 **、#、列表符号）
- 段落之间仅用单个换行分隔`;

  const user = `全文大纲：
${buildOutlineTitlesList(project.outline)}

上一节摘要：${previousSummary}

当前章节：${section.title}
写作要点：${section.brief || "按标题展开"}

请撰写本节正文。`;

  return { system, user };
}

export function buildFullReviewPrompt(
  template: WritingTemplate,
  project: WritingProject,
  mode: "proofread" | "polish"
): { system: string; user: string } {
  const combined = project.outline
    .filter((section) => section.content?.trim())
    .map((section) => `【${section.title}】\n${section.content?.trim()}`)
    .join("\n\n");

  const task =
    mode === "proofread"
      ? "对全文进行校对，仅修正标点符号和错字，不得改写或润色。"
      : "对全文进行润色，改善表达流畅度，但不改变事实内容。";

  const system = `${template.systemPrompt}

【任务】${task}
【输出要求】
- 按原章节顺序输出
- 每章以「【章节标题】」开头，后跟正文
- 不要 Markdown 标记`;

  const user = `文档标题：${project.title}

${combined}`;

  return { system, user };
}

export function buildDocumentGapAnalysisPrompt(
  template: WritingTemplate,
  topic: string,
  documentHeadings: DocumentHeading[],
  documentExcerpt: string
): { system: string; user: string } {
  const existing = documentHeadings.map((item) => `[L${item.level}] ${item.title}`).join("\n") || "（未检测到标题）";
  const skeleton = template.outlineSkeleton.map((item) => `[L${item.level}] ${item.title}`).join("\n");

  const system = `你是一位文档结构分析助手。比较模板大纲与 Word 文档已有标题，找出缺失章节。
仅输出 JSON：
{
  "title": "建议文档标题",
  "sections": [
    { "id": "唯一字符串", "level": 1, "title": "缺失章节标题", "brief": "建议写作内容" }
  ]
}
sections 只包含文档中缺失或明显不完整的章节。`;

  const user = `主题：${topic.trim()}
模板：${template.name}
模板骨架：
${skeleton}

文档已有标题：
${existing}

文档摘要（前 3000 字）：
${documentExcerpt.slice(0, 3000)}`;

  return { system, user };
}
