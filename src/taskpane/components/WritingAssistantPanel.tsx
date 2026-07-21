import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppSettings, WritingOutlineSection, WritingProject } from "../types";
import { getAllWritingTemplates, getWritingTemplateById, cloneTemplateOutline, createEmptyWritingProject } from "../prompts/writing/templates";
import {
  analyzeDocumentGaps,
  generateSectionContent,
  generateWritingOutline,
  getNextPendingSection,
  getWritingProgress,
  runFullDocumentReview,
} from "../services/writingService";
import {
  captureCursor,
  clearTrackedRange,
  insertSectionWithHeading,
  readDocumentHeadings,
  readDocumentTextForAttachment,
} from "../services/wordService";
import { loadSettings } from "../services/storageService";
import { getInsertFirstLineIndentChars, prepareTextForWordDocument } from "../utils/textFormat";
import { OutlineEditor } from "./OutlineEditor";
import { WritingStepper } from "./WritingStepper";
import { WritingTemplateManager, saveOutlineAsTemplate } from "./WritingTemplateManager";

interface WritingAssistantPanelProps {
  settings: AppSettings;
  project: WritingProject | null;
  disabled?: boolean;
  onProjectChange: (project: WritingProject | null) => Promise<void>;
  onSettingsChange: (settings: AppSettings) => void;
  onNotify: (text: string) => void;
  initialTemplateId?: string;
}

type WritingPhase = "setup" | "outline" | "writing" | "review";

function resolvePhase(project: WritingProject | null): WritingPhase {
  if (!project) return "setup";
  if (project.status === "setup") return "setup";
  if (project.status === "outline" || project.outline.length === 0) return "outline";
  if (project.status === "review" || project.status === "done") return "review";
  return "writing";
}

export function WritingAssistantPanel({
  settings,
  project,
  disabled,
  onProjectChange,
  onSettingsChange,
  onNotify,
  initialTemplateId,
}: WritingAssistantPanelProps) {
  const [localProject, setLocalProject] = useState<WritingProject | null>(project);
  const [templateId, setTemplateId] = useState(project?.templateId || initialTemplateId || "work-plan");
  const [topic, setTopic] = useState(project?.topic || "");
  const [extraNotes, setExtraNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [reviewMode, setReviewMode] = useState<"proofread" | "polish">("proofread");
  const abortRef = useRef<AbortController | null>(null);

  const templates = getAllWritingTemplates(settings);
  const phase = resolvePhase(localProject);
  const progress = localProject ? getWritingProgress(localProject) : { done: 0, total: 0 };
  const currentSection = localProject?.outline.find((item) => item.id === localProject.currentSectionId) ?? null;

  useEffect(() => {
    setLocalProject(project);
    if (project) {
      setTemplateId(project.templateId);
      setTopic(project.topic);
    }
  }, [project]);

  useEffect(() => {
    if (initialTemplateId && !project) {
      setTemplateId(initialTemplateId);
    }
  }, [initialTemplateId, project]);

  const persistProject = useCallback(
    async (next: WritingProject | null) => {
      setLocalProject(next);
      await onProjectChange(next);
    },
    [onProjectChange]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  const handleUseTemplateSkeleton = async () => {
    const template = getWritingTemplateById(settings, templateId);
    if (!template) {
      onNotify("未找到模板");
      return;
    }

    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      onNotify("请先输入写作主题");
      return;
    }

    const next: WritingProject = {
      ...createEmptyWritingProject(templateId, trimmedTopic),
      title: trimmedTopic,
      outline: cloneTemplateOutline(template),
      status: "outline",
      currentSectionId: cloneTemplateOutline(template)[0]?.id ?? null,
    };
    await persistProject(next);
    onNotify("已载入模板骨架，可编辑后开始写作");
  };

  const handleGenerateOutline = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      onNotify("请先输入写作主题");
      return;
    }

    const base = localProject ?? createEmptyWritingProject(templateId, trimmedTopic);
    setBusy(true);
    setStreamingContent("");

    const result = await generateWritingOutline(settings, { ...base, topic: trimmedTopic }, extraNotes);
    setBusy(false);

    if (result.error) {
      onNotify(result.error);
      return;
    }

    await persistProject(result.project);
    onNotify("大纲已生成，请确认后开始分节写作");
  };

  const handleAnalyzeDocument = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      onNotify("请先输入写作主题");
      return;
    }

    setBusy(true);
    const doc = await readDocumentTextForAttachment();
    const headingsResult = await readDocumentHeadings();

    if (!doc.success || !doc.text.trim()) {
      setBusy(false);
      onNotify(doc.error || "无法读取 Word 文档");
      return;
    }

    const result = await analyzeDocumentGaps(
      settings,
      templateId,
      trimmedTopic,
      headingsResult.headings,
      doc.text
    );
    setBusy(false);

    if (result.error) {
      onNotify(result.error);
      if (result.project.outline.length > 0) {
        await persistProject(result.project);
      }
      return;
    }

    await persistProject(result.project);
    onNotify(`已识别 ${result.project.outline.length} 个待续写章节`);
  };

  const handleOutlineChange = async (outline: WritingOutlineSection[]) => {
    if (!localProject) return;
    await persistProject({
      ...localProject,
      outline,
      currentSectionId: localProject.currentSectionId || outline[0]?.id || null,
      updatedAt: Date.now(),
    });
  };

  const handleStartWriting = async () => {
    if (!localProject || localProject.outline.length === 0) {
      onNotify("请先生成或编辑大纲");
      return;
    }

    const first = localProject.outline[0];
    await persistProject({
      ...localProject,
      status: "writing",
      currentSectionId: first.id,
      updatedAt: Date.now(),
    });
    onNotify("已进入分节写作，点击光标定位插入位置");
  };

  const handleSelectSection = async (sectionId: string) => {
    if (!localProject) return;
    await persistProject({
      ...localProject,
      currentSectionId: sectionId,
      status: "writing",
      updatedAt: Date.now(),
    });
  };

  const handleGenerateSection = async (sectionId?: string) => {
    if (!localProject) return;
    const targetId = sectionId || localProject.currentSectionId || localProject.outline[0]?.id;
    if (!targetId) {
      onNotify("请先选择章节");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setStreamingContent("");

    const generatingOutline = localProject.outline.map((section) =>
      section.id === targetId ? { ...section, status: "generating" as const } : section
    );
    const workingProject = {
      ...localProject,
      outline: generatingOutline,
      currentSectionId: targetId,
      status: "writing" as const,
    };
    await persistProject(workingProject);

    const result = await generateSectionContent(settings, workingProject, targetId, {
      signal: controller.signal,
      onChunk: (_delta, full) => setStreamingContent(full),
    });

    setBusy(false);
    abortRef.current = null;

    if (result.error && !result.aborted) {
      onNotify(result.error);
    }

    await persistProject(result.project);
    setStreamingContent(result.content);

    if (result.project.autoNextSection && !result.aborted) {
      const next = getNextPendingSection(result.project);
      if (next && next.id !== targetId) {
        await persistProject({ ...result.project, currentSectionId: next.id });
      }
    }
  };

  const handleInsertSection = async (section?: WritingOutlineSection) => {
    const target = section || currentSection;
    if (!target?.content?.trim()) {
      onNotify("请先生成本节内容");
      return;
    }

    await captureCursor();
    const latestSettings = await loadSettings();
    const cleanedBody = prepareTextForWordDocument(target.content, "");
    const indentChars = getInsertFirstLineIndentChars(latestSettings, false);

    const result = await insertSectionWithHeading(target.title, cleanedBody, target.level, {
      firstLineIndentChars: indentChars,
    });

    if (result.success) {
      onNotify(`已插入「${target.title}」`);
      clearTrackedRange();

      if (localProject?.autoNextSection) {
        const next = getNextPendingSection(localProject);
        if (next) {
          await persistProject({ ...localProject, currentSectionId: next.id });
        }
      }
    } else {
      onNotify(result.error || "插入失败");
    }
  };

  const handleInsertAllSections = async () => {
    if (!localProject) return;
    await captureCursor();

    const latestSettings = await loadSettings();
    const indentChars = getInsertFirstLineIndentChars(latestSettings, false);
    let inserted = 0;

    for (const section of localProject.outline) {
      if (!section.content?.trim()) continue;
      const cleanedBody = prepareTextForWordDocument(section.content, "");
      const result = await insertSectionWithHeading(section.title, cleanedBody, section.level, {
        firstLineIndentChars: indentChars,
      });
      if (result.success) inserted += 1;
    }

    clearTrackedRange();
    onNotify(inserted > 0 ? `已插入 ${inserted} 个章节` : "没有可插入的章节内容");
  };

  const handleFullReview = async () => {
    if (!localProject) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setStreamingContent("");

    const result = await runFullDocumentReview(settings, localProject, reviewMode, {
      signal: controller.signal,
      onChunk: (_delta, full) => setStreamingContent(full),
    });

    setBusy(false);
    abortRef.current = null;

    if (result.error && !result.aborted) {
      onNotify(result.error);
    } else {
      onNotify(reviewMode === "proofread" ? "全文校对完成" : "全文润色完成");
    }

    await persistProject(result.project);
  };

  const handleSaveAsTemplate = async () => {
    if (!localProject || localProject.outline.length === 0) {
      onNotify("当前没有可保存的大纲");
      return;
    }

    const template = getWritingTemplateById(settings, localProject.templateId);
    await saveOutlineAsTemplate(
      `${localProject.title} 模板`,
      `基于「${localProject.title}」保存`,
      localProject.outline,
      template?.systemPrompt || "",
      template?.sectionRules || "",
      onSettingsChange,
      onNotify
    );
  };

  const handleReset = async () => {
    stopGeneration();
    setStreamingContent("");
    setExtraNotes("");
    await persistProject(null);
    onNotify("已重置写作项目");
  };

  return (
    <div className="writing-assistant-panel">
      <div className="writing-panel-header">
        <div>
          <h2 className="writing-panel-title">写作助手</h2>
          <p className="writing-panel-subtitle">大纲生成 · 分节写作 · 全文统稿</p>
        </div>
        {localProject && (
          <button type="button" className="writing-link-btn" onClick={() => void handleReset()} disabled={disabled || busy}>
            重置
          </button>
        )}
      </div>

      {(phase === "setup" || !localProject) && (
        <section className="writing-section">
          <label className="writing-label">写作模板</label>
          <select
            className="writing-select"
            value={templateId}
            disabled={disabled || busy}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <p className="writing-hint">{getWritingTemplateById(settings, templateId)?.description}</p>

          <label className="writing-label">写作主题</label>
          <textarea
            className="writing-textarea"
            rows={3}
            value={topic}
            disabled={disabled || busy}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="例如：2026 年数字化转型工作方案"
          />

          <label className="writing-label">补充要求（可选）</label>
          <input
            className="writing-input"
            value={extraNotes}
            disabled={disabled || busy}
            onChange={(event) => setExtraNotes(event.target.value)}
            placeholder="字数、受众、必须包含的章节等"
          />

          <div className="writing-action-row">
            <button type="button" className="writing-primary-btn" disabled={disabled || busy} onClick={() => void handleGenerateOutline()}>
              AI 生成大纲
            </button>
            <button type="button" className="writing-secondary-btn" disabled={disabled || busy} onClick={() => void handleUseTemplateSkeleton()}>
              使用模板骨架
            </button>
          </div>

          <div className="writing-action-row">
            <button type="button" className="writing-secondary-btn" disabled={disabled || busy} onClick={() => void handleAnalyzeDocument()}>
              从 Word 文档续写
            </button>
          </div>

          <WritingTemplateManager
            settings={settings}
            disabled={disabled || busy}
            onSettingsChange={onSettingsChange}
            onNotify={onNotify}
          />
        </section>
      )}

      {localProject && phase === "outline" && (
        <section className="writing-section">
          <div className="writing-section-head">
            <h3>{localProject.title}</h3>
            <span>{localProject.outline.length} 节</span>
          </div>

          <OutlineEditor sections={localProject.outline} disabled={disabled || busy} onChange={(outline) => void handleOutlineChange(outline)} />

          <div className="writing-action-row">
            <button type="button" className="writing-primary-btn" disabled={disabled || busy} onClick={() => void handleStartWriting()}>
              开始分节写作
            </button>
            <button type="button" className="writing-secondary-btn" disabled={disabled || busy} onClick={() => void handleGenerateOutline()}>
              重新生成大纲
            </button>
            <button type="button" className="writing-link-btn" disabled={disabled || busy} onClick={() => void handleSaveAsTemplate()}>
              存为模板
            </button>
          </div>
        </section>
      )}

      {localProject && (phase === "writing" || phase === "review") && (
        <>
          <section className="writing-section writing-progress-bar">
            <span>
              进度 {progress.done}/{progress.total}
            </span>
            <label className="writing-auto-next">
              <input
                type="checkbox"
                checked={localProject.autoNextSection}
                disabled={disabled || busy}
                onChange={(event) =>
                  void persistProject({ ...localProject, autoNextSection: event.target.checked, updatedAt: Date.now() })
                }
              />
              自动下一节
            </label>
          </section>

          <WritingStepper
            sections={localProject.outline}
            currentSectionId={localProject.currentSectionId}
            disabled={disabled || busy}
            onSelect={(sectionId) => void handleSelectSection(sectionId)}
          />

          {currentSection && (
            <section className="writing-section">
              <div className="writing-section-head">
                <h3>{currentSection.title}</h3>
                <span>{currentSection.brief}</span>
              </div>

              <div className="writing-action-row">
                <button
                  type="button"
                  className="writing-primary-btn"
                  disabled={disabled || busy}
                  onClick={() => void handleGenerateSection(currentSection.id)}
                >
                  {busy ? "生成中…" : "生成本节"}
                </button>
                {busy && (
                  <button type="button" className="writing-secondary-btn" onClick={stopGeneration}>
                    停止
                  </button>
                )}
                <button
                  type="button"
                  className="writing-secondary-btn"
                  disabled={disabled || busy || !currentSection.content?.trim()}
                  onClick={() => void handleInsertSection(currentSection)}
                >
                  插入到 Word
                </button>
              </div>

              {(streamingContent || currentSection.content) && (
                <div className="writing-preview">
                  {streamingContent || currentSection.content}
                </div>
              )}
            </section>
          )}

          <section className="writing-section">
            <div className="writing-section-head">
              <h3>全文统稿</h3>
              <span>全部章节完成后可一键校对或润色</span>
            </div>
            <div className="writing-review-mode">
              <label>
                <input type="radio" name="reviewMode" checked={reviewMode === "proofread"} onChange={() => setReviewMode("proofread")} />
                校对
              </label>
              <label>
                <input type="radio" name="reviewMode" checked={reviewMode === "polish"} onChange={() => setReviewMode("polish")} />
                润色
              </label>
            </div>
            <div className="writing-action-row">
              <button type="button" className="writing-secondary-btn" disabled={disabled || busy} onClick={() => void handleFullReview()}>
                全文统稿
              </button>
              <button type="button" className="writing-secondary-btn" disabled={disabled || busy} onClick={() => void handleInsertAllSections()}>
                插入全部章节
              </button>
              <button type="button" className="writing-link-btn" disabled={disabled || busy} onClick={() => void handleSaveAsTemplate()}>
                存为模板
              </button>
            </div>
          </section>

          <OutlineEditor sections={localProject.outline} disabled={disabled || busy} onChange={(outline) => void handleOutlineChange(outline)} />
        </>
      )}
    </div>
  );
}
