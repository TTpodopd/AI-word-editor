import { AppSettings, DocumentHeading, WritingOutlineSection, WritingProject, WritingTemplate } from "../../types";
import { buildOutlineTitlesList, summarizeSectionContent } from "./outlineParser";
import { isOfficialDocumentTemplate } from "./officialDocumentTemplates";

export function buildOutlineGenerationPrompt(
  template: WritingTemplate,
  topic: string,
  extraNotes?: string
): { system: string; user: string } {
  const skeleton = template.outlineSkeleton
    .map((item) => `- [L${item.level}] ${item.title}：${item.brief}`)
    .join("\n");

  const officialRules = isOfficialDocumentTemplate(template)
    ? `
- 严格遵循该文种的法定适用范围和行文规则
- 标题格式为"发文机关＋关于＋事由＋文种"
- 章节结构应贴近模板骨架，不宜随意增删文种必备要素
- 涉及文号、机关名称、日期处使用"＋占位符＋"格式`
    : `
- 章节数量 4-10 个，可参照模板骨架调整`;

  const extraNotesBlock = extraNotes?.trim()
    ? `

【补充要求（必须体现在大纲中）】
${extraNotes.trim()}

要求：
- 将补充要求中的机关名称、会议名称、日期、政策依据、具体人物/事项等关键信息写入文档 title
- 各 section 的 brief 须体现与补充要求相关的具体信息，不得仅复述模板骨架
- 不得忽略或遗漏用户补充的任何要点`
    : "";

  const extraNotesSystemRule = extraNotes?.trim()
    ? "\n- 用户提供的补充要求必须完整融入 title 与各 section 的 brief，不得忽略"
    : "";

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
- level 只能是 1、2 或 3${officialRules}${extraNotesSystemRule}
- brief 一句话说明该节写什么，须包含可指导写作的具体要点`;

  const officialFields = isOfficialDocumentTemplate(template)
    ? `\n建议采集字段：发文机关、主送机关、事项名称、行文目的、政策依据、核心事实、任务/请求/决定事项、责任单位、时间节点`
    : "";

  const user = `主题：${topic.trim()}
模板：${template.name}
模板骨架参考：
${skeleton}${officialFields}${extraNotesBlock}`;

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

  const officialHint = isOfficialDocumentTemplate(template)
    ? `\n【公文提示】保留文号、机关名称、日期等占位符；严格遵循${template.name}文种规范。`
    : "";

  const system = `${template.systemPrompt}

【写作规则】
${template.sectionRules}${officialHint}

【当前文档】
标题：${project.title}
主题：${project.topic}

【输出要求】
- 只输出「${section.title}」的正文内容
- 不要重复输出章节标题
- 不要输出 Markdown 标记（如 **、#、列表符号）
- 不要输出 emoji、特殊符号或分隔线
- 段落之间仅用单个换行分隔，不要连续空行
- 直接输出可写入 Word 的纯文本`;

  const extraNotesHint = project.extraNotes?.trim()
    ? `\n\n补充要求：${project.extraNotes.trim()}`
    : "";

  const user = `全文大纲：
${buildOutlineTitlesList(project.outline)}

上一节摘要：${previousSummary}

当前章节：${section.title}
写作要点：${section.brief || "按标题展开"}${extraNotesHint}

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
