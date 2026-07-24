import { AppSettings, ChatMessage, DocumentHeading, ResolvedModel, WritingOutlineSection, WritingProject } from "../types";
import { resolveModel } from "./modelService";
import { sendChatStreamWithModel, sendChatWithModel } from "./llmService";
import {
  buildDocumentGapAnalysisPrompt,
  buildFullReviewPrompt,
  buildOutlineGenerationPrompt,
  buildSectionWritingPrompt,
} from "../prompts/writing/prompts";
import { parseOutlineResponse } from "../prompts/writing/outlineParser";
import { getWritingTemplateById } from "../prompts/writing/templates";
import { normalizeWritingSectionText } from "../utils/textFormat";

export interface WritingStreamOptions {
  signal?: AbortSignal;
  onChunk?: (delta: string, fullContent: string) => void;
}

async function runWritingChat(
  settings: AppSettings,
  messages: ChatMessage[],
  options?: WritingStreamOptions
): Promise<{ content: string; error?: string; aborted?: boolean }> {
  const model = resolveModel(settings);
  if (!model) {
    return { content: "", error: "未找到可用模型，请检查设置" };
  }
  if (!model.apiKey) {
    return { content: "", error: "请先在设置中配置 API Key" };
  }

  if (options?.onChunk) {
    return sendChatStreamWithModel(model, messages, {
      signal: options.signal,
      onChunk: options.onChunk,
      settingsOverride: settings,
    });
  }

  return sendChatWithModel(model, messages, settings, options?.signal);
}

export async function generateWritingOutline(
  settings: AppSettings,
  project: WritingProject,
  extraNotes?: string
): Promise<{ project: WritingProject; error?: string }> {
  const template = getWritingTemplateById(settings, project.templateId);
  if (!template) {
    return { project, error: "未找到写作模板" };
  }
  if (!project.topic.trim()) {
    return { project, error: "请先输入写作主题" };
  }

  const { system, user } = buildOutlineGenerationPrompt(template, project.topic, extraNotes);
  const response = await runWritingChat(settings, [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  if (response.error) {
    return { project, error: response.error };
  }

  const parsed = parseOutlineResponse(response.content);
  if (!parsed) {
    return { project, error: "大纲解析失败，请重试" };
  }

  return {
    project: {
      ...project,
      title: parsed.title,
      extraNotes: extraNotes?.trim() || project.extraNotes || "",
      outline: parsed.sections,
      status: "outline",
      currentSectionId: parsed.sections[0]?.id ?? null,
      updatedAt: Date.now(),
    },
  };
}

export async function generateSectionContent(
  settings: AppSettings,
  project: WritingProject,
  sectionId: string,
  options?: WritingStreamOptions
): Promise<{ project: WritingProject; content: string; error?: string; aborted?: boolean }> {
  const template = getWritingTemplateById(settings, project.templateId);
  if (!template) {
    return { project, content: "", error: "未找到写作模板" };
  }

  const section = project.outline.find((item) => item.id === sectionId);
  if (!section) {
    return { project, content: "", error: "未找到目标章节" };
  }

  const { system, user } = buildSectionWritingPrompt(settings, template, project, section);
  const response = await runWritingChat(
    settings,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options
  );

  if (response.error) {
    return { project, content: response.content, error: response.error, aborted: response.aborted };
  }

  const content = normalizeWritingSectionText(response.content.trim());
  const nextOutline = project.outline.map((item) =>
    item.id === sectionId
      ? { ...item, content, status: "done" as const }
      : item
  );

  const pending = nextOutline.find((item) => item.status !== "done");
  const allDone = !pending;

  return {
    project: {
      ...project,
      outline: nextOutline,
      currentSectionId: sectionId,
      status: allDone ? "review" : "writing",
      updatedAt: Date.now(),
    },
    content,
    aborted: response.aborted,
  };
}

export async function runFullDocumentReview(
  settings: AppSettings,
  project: WritingProject,
  mode: "proofread" | "polish",
  options?: WritingStreamOptions
): Promise<{ project: WritingProject; content: string; error?: string; aborted?: boolean }> {
  const template = getWritingTemplateById(settings, project.templateId);
  if (!template) {
    return { project, content: "", error: "未找到写作模板" };
  }

  const hasContent = project.outline.some((section) => section.content?.trim());
  if (!hasContent) {
    return { project, content: "", error: "尚无章节正文，无法统稿" };
  }

  const { system, user } = buildFullReviewPrompt(template, project, mode);
  const response = await runWritingChat(
    settings,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options
  );

  if (response.error) {
    return { project, content: response.content, error: response.error, aborted: response.aborted };
  }

  const updatedOutline = applyReviewContentToOutline(project.outline, response.content.trim());

  return {
    project: {
      ...project,
      outline: updatedOutline,
      status: "done",
      updatedAt: Date.now(),
    },
    content: response.content.trim(),
    aborted: response.aborted,
  };
}

function applyReviewContentToOutline(
  outline: WritingOutlineSection[],
  reviewedText: string
): WritingOutlineSection[] {
  const chunks = reviewedText.split(/(?=【[^】]+】)/).filter((chunk) => chunk.trim());
  if (chunks.length === 0) {
    return outline;
  }

  const contentMap = new Map<string, string>();
  for (const chunk of chunks) {
    const match = chunk.match(/^【([^】]+)】\s*([\s\S]*)$/);
    if (!match) continue;
    contentMap.set(match[1].trim(), match[2].trim());
  }

  if (contentMap.size === 0) {
    return outline;
  }

  return outline.map((section) => {
    const reviewed = contentMap.get(section.title.trim());
    if (!reviewed) return section;
    return { ...section, content: reviewed, status: "done" as const };
  });
}

export async function analyzeDocumentGaps(
  settings: AppSettings,
  templateId: string,
  topic: string,
  documentHeadings: DocumentHeading[],
  documentText: string
): Promise<{ project: WritingProject; error?: string }> {
  const template = getWritingTemplateById(settings, templateId);
  if (!template) {
    return {
      project: {
        templateId,
        topic,
        title: topic || "续写文档",
        outline: [],
        currentSectionId: null,
        status: "setup",
        autoNextSection: true,
        importedFromDocument: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      error: "未找到写作模板",
    };
  }

  const { system, user } = buildDocumentGapAnalysisPrompt(template, topic, documentHeadings, documentText);
  const response = await runWritingChat(settings, [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  if (response.error) {
    return {
      project: {
        templateId,
        topic,
        title: topic || "续写文档",
        outline: [],
        currentSectionId: null,
        status: "setup",
        autoNextSection: true,
        importedFromDocument: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      error: response.error,
    };
  }

  const parsed = parseOutlineResponse(response.content);
  if (!parsed || parsed.sections.length === 0) {
    return {
      project: {
        templateId,
        topic,
        title: topic || "续写文档",
        outline: [],
        currentSectionId: null,
        status: "outline",
        autoNextSection: true,
        importedFromDocument: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      error: "未检测到缺失章节，文档结构可能已完整",
    };
  }

  return {
    project: {
      templateId,
      topic,
      title: parsed.title,
      outline: parsed.sections,
      currentSectionId: parsed.sections[0]?.id ?? null,
      status: "writing",
      autoNextSection: true,
      importedFromDocument: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

export function getNextPendingSection(project: WritingProject): WritingOutlineSection | null {
  const currentIndex = project.outline.findIndex((item) => item.id === project.currentSectionId);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;

  for (let index = startIndex; index < project.outline.length; index += 1) {
    const section = project.outline[index];
    if (section.status !== "done" || !section.content?.trim()) {
      return section;
    }
  }

  return project.outline.find((section) => section.status !== "done" || !section.content?.trim()) ?? null;
}

export function getWritingProgress(project: WritingProject): { done: number; total: number } {
  const total = project.outline.length;
  const done = project.outline.filter((section) => section.content?.trim()).length;
  return { done, total };
}
