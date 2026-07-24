import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppSettings, WritingOutlineSection, WritingProject } from "../types";
import { getAllWritingTemplates, getWritingTemplateById, cloneTemplateOutline, createEmptyWritingProject } from "../prompts/writing/templates";
import { isOfficialDocumentTemplate } from "../prompts/writing/officialDocumentTemplates";
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
  insertWritingDocument,
  readDocumentHeadings,
  readDocumentTextForAttachment,
} from "../services/wordService";
import { loadSettings } from "../services/storageService";
import {
  getInsertFirstLineIndentChars,
  normalizeWritingSectionText,
  OFFICIAL_DOCUMENT_FIRST_LINE_INDENT,
} from "../utils/textFormat";
import { OutlineEditor } from "./OutlineEditor";
import { WritingStepper } from "./WritingStepper";
import { WritingTemplateManager, saveOutlineAsTemplate } from "./WritingTemplateManager";
import { WritingTemplatePicker } from "./WritingTemplatePicker";

interface WritingAssistantPanelProps {
  settings: AppSettings;
  project: WritingProject | null;
  disabled?: boolean;
  onProjectChange: (project: WritingProject | null) => Promise<void>;
  onSettingsChange: (settings: AppSettings) => void;
  onNotify: (text: string) => void;
  initialTemplateId?: string;
  onBusyChange?: (busy: boolean) => void;
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
  onBusyChange,
}: WritingAssistantPanelProps) {
  const [localProject, setLocalProject] = useState<WritingProject | null>(project);
  const [templateId, setTemplateId] = useState(project?.templateId || initialTemplateId || "work-plan");
  const [topic, setTopic] = useState(project?.topic || "");
  const [extraNotes, setExtraNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSectionId, setStreamingSectionId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"proofread" | "polish">("proofread");
  const [loadingNote, setLoadingNote] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const topicInputRef = useRef<HTMLTextAreaElement>(null);

  const templates = getAllWritingTemplates(settings);
  const phase = resolvePhase(localProject);
  const selectedTemplate = getWritingTemplateById(settings, templateId);
  const isOfficialDoc = selectedTemplate ? isOfficialDocumentTemplate(selectedTemplate) : false;
  const progress = localProject ? getWritingProgress(localProject) : { done: 0, total: 0 };
  const currentSection = localProject?.outline.find((item) => item.id === localProject.currentSectionId) ?? null;

  const getSectionPreviewContent = useCallback(
    (section: WritingOutlineSection | null | undefined): string => {
      if (!section) return "";
      if (busy && streamingSectionId === section.id) {
        return streamingContent;
      }
      return section.content?.trim() || "";
    },
    [busy, streamingContent, streamingSectionId]
  );

  const currentPreviewContent = getSectionPreviewContent(currentSection);
  const isStreamingCurrentSection = busy && streamingSectionId === currentSection?.id;

  useEffect(() => {
    setLocalProject(project);
    if (project) {
      setTemplateId(project.templateId);
      setTopic(project.topic);
      if (project.extraNotes !== undefined) {
        setExtraNotes(project.extraNotes);
      }
    }
  }, [project]);

  useEffect(() => {
    if (initialTemplateId && !project) {
      setTemplateId(initialTemplateId);
    }
  }, [initialTemplateId, project]);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    return () => {
      onBusyChange?.(false);
    };
  }, [onBusyChange]);

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
    setStreamingContent("");
    setStreamingSectionId(null);
  }, []);

  const focusTopicField = useCallback(() => {
    window.requestAnimationFrame(() => {
      topicInputRef.current?.focus();
      topicInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const handleTemplateSelect = useCallback(
    (id: string) => {
      const changed = id !== templateId;
      setTemplateId(id);
      if (changed) {
        focusTopicField();
      }
    },
    [focusTopicField, templateId]
  );

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
      extraNotes: extraNotes.trim(),
      outline: cloneTemplateOutline(template).map((section) => {
        const needsContext =
          /标题|会议|导语|开篇|通过|落款|字号|主送|受函|上级|引述/.test(section.title) ||
          /会议|机关|日期|年月日/.test(section.brief);
        if (!extraNotes.trim() || !needsContext) return section;
        return {
          ...section,
          brief: `${section.brief}；补充：${extraNotes.trim()}`,
        };
      }),
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
    setLoadingNote("正在生成大纲，请稍候…");
    setStreamingContent("");

    try {
      const result = await generateWritingOutline(settings, { ...base, topic: trimmedTopic }, extraNotes);
      if (result.error) {
        onNotify(result.error);
        return;
      }

      await persistProject(result.project);
      onNotify("大纲已生成，请确认后开始分节写作");
    } finally {
      setBusy(false);
      setLoadingNote("");
    }
  };

  const handleAnalyzeDocument = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      onNotify("请先输入写作主题");
      return;
    }

    setBusy(true);
    setLoadingNote("正在分析 Word 文档，请稍候…");

    try {
      const doc = await readDocumentTextForAttachment();
      const headingsResult = await readDocumentHeadings();

      if (!doc.success || !doc.text.trim()) {
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

      if (result.error) {
        onNotify(result.error);
        if (result.project.outline.length > 0) {
          await persistProject(result.project);
        }
        return;
      }

      await persistProject(result.project);
      onNotify(`已识别 ${result.project.outline.length} 个待续写章节`);
    } finally {
      setBusy(false);
      setLoadingNote("");
    }
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
    if (!localProject || sectionId === localProject.currentSectionId) return;
    if (!busy) {
      setStreamingContent("");
      setStreamingSectionId(null);
    }
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
    setStreamingSectionId(targetId);

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

    if (!result.aborted) {
      setStreamingContent("");
      setStreamingSectionId(null);
    }

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
    const template = getWritingTemplateById(settings, localProject?.templateId || templateId);
    const officialDoc = template ? isOfficialDocumentTemplate(template) : false;
    const cleanedBody = normalizeWritingSectionText(target.content, "");
    const indentChars = officialDoc
      ? OFFICIAL_DOCUMENT_FIRST_LINE_INDENT
      : getInsertFirstLineIndentChars(await loadSettings(), false) || 2;

    const result = await insertWritingDocument(
      [{ title: target.title, body: cleanedBody, level: target.level }],
      {
        formatMode: officialDoc ? "official-document" : "standard",
        firstLineIndentChars: indentChars,
      }
    );

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

  const handleInsertAllSections = async (targetProject?: WritingProject): Promise<number> => {
    const source = targetProject ?? localProject;
    if (!source) return 0;
    await captureCursor();

    const template = getWritingTemplateById(settings, source.templateId);
    const officialDoc = template ? isOfficialDocumentTemplate(template) : false;
    const latestSettings = await loadSettings();
    const indentChars = officialDoc
      ? OFFICIAL_DOCUMENT_FIRST_LINE_INDENT
      : getInsertFirstLineIndentChars(latestSettings, false) || 2;

    const sections = source.outline
      .filter((section) => section.content?.trim())
      .map((section) => ({
        title: section.title,
        body: normalizeWritingSectionText(section.content || "", ""),
        level: section.level,
      }));

    const result = await insertWritingDocument(sections, {
      formatMode: officialDoc ? "official-document" : "standard",
      firstLineIndentChars: indentChars,
    });

    clearTrackedRange();
    if (!targetProject) {
      onNotify(
        result.inserted > 0
          ? `已插入 ${result.inserted} 个章节`
          : result.error || "没有可插入的章节内容"
      );
    }
    return result.inserted;
  };

  const handleGenerateFullDocument = async () => {
    if (!localProject || localProject.outline.length === 0) {
      onNotify("请先生成或编辑大纲");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setStreamingContent("");

    let working: WritingProject = {
      ...localProject,
      status: "writing",
      currentSectionId: localProject.outline[0]?.id ?? null,
      updatedAt: Date.now(),
    };
    await persistProject(working);

    const total = working.outline.length;
    let index = 0;
    let failed = false;

    for (const section of localProject.outline) {
      if (controller.signal.aborted) break;
      index += 1;
      setLoadingNote(`正在生成 (${index}/${total})：${section.title}`);
      setStreamingContent("");
      setStreamingSectionId(section.id);

      const generatingOutline = working.outline.map((item) =>
        item.id === section.id ? { ...item, status: "generating" as const } : item
      );
      working = { ...working, outline: generatingOutline, currentSectionId: section.id };
      await persistProject(working);

      const result = await generateSectionContent(settings, working, section.id, {
        signal: controller.signal,
        onChunk: (_delta, full) => setStreamingContent(full),
      });

      working = result.project;
      await persistProject(working);

      if (result.aborted) break;
      if (result.error) {
        onNotify(result.error);
        failed = true;
        break;
      }
    }

    setBusy(false);
    abortRef.current = null;
    setStreamingContent("");
    setStreamingSectionId(null);
    setLoadingNote("");

    if (controller.signal.aborted) {
      onNotify("已停止生成");
      return;
    }
    if (failed) return;

    setLoadingNote("正在插入 Word…");
    const inserted = await handleInsertAllSections(working);
    setLoadingNote("");
    onNotify(inserted > 0 ? `已生成并插入 ${inserted} 个章节，可继续修改` : "生成完成，但没有可插入的内容");
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
    setStreamingSectionId(null);
    setExtraNotes("");
    setLoadingNote("");
    await persistProject(null);
    onNotify("已重置写作项目");
  };

  const renderLoadingBanner = (showStop = false) =>
    busy && loadingNote ? (
      <div className="writing-loading-note" role="status" aria-live="polite">
        <span className="writing-loading-spinner" aria-hidden="true" />
        <span className="writing-loading-text">{loadingNote}</span>
        {showStop ? (
          <button type="button" className="writing-link-btn" onClick={stopGeneration}>
            停止
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="writing-assistant-panel">
      <div className="writing-panel-header">
        <div>
          <h2 className="writing-panel-title">写作助手</h2>
          <p className="writing-panel-subtitle">大纲生成 · 分节写作 · 全文统稿</p>
        </div>
        {localProject && (
          <button
            type="button"
            className="writing-reset-btn"
            onClick={() => void handleReset()}
            disabled={disabled || busy}
          >
            重置
          </button>
        )}
      </div>

      {(phase === "setup" || !localProject) && (
        <div className="writing-setup-steps">
          <section className="writing-setup-step writing-setup-step--done">
            <header className="writing-setup-step-header">
              <span className="writing-setup-step-num" aria-hidden="true">
                1
              </span>
              <div className="writing-setup-step-heading">
                <h3 className="writing-setup-step-title">选择写作模板</h3>
                <p className="writing-setup-step-desc">选定文种或方案类型，确定大纲结构</p>
              </div>
              <span className="writing-section-badge">{templates.length} 个可用</span>
            </header>
            <div className="writing-setup-step-body">
              <WritingTemplatePicker
                templates={templates}
                selectedId={templateId}
                disabled={disabled || busy}
                onSelect={handleTemplateSelect}
                onSettingsChange={onSettingsChange}
                onNotify={onNotify}
              />
              <WritingTemplateManager
                settings={settings}
                disabled={disabled || busy}
                onSettingsChange={onSettingsChange}
                onNotify={onNotify}
              />
            </div>
          </section>

          <section className={`writing-setup-step${!topic.trim() ? " writing-setup-step--active" : ""}`}>
            <header className="writing-setup-step-header">
              <span className="writing-setup-step-num" aria-hidden="true">
                2
              </span>
              <div className="writing-setup-step-heading">
                <h3 className="writing-setup-step-title">填写写作主题</h3>
                <p className="writing-setup-step-desc">输入文档标题或核心事由，作为生成大纲的依据</p>
              </div>
            </header>
            <div className="writing-setup-step-body">
              <textarea
                ref={topicInputRef}
                className="writing-textarea writing-setup-topic-input"
                rows={3}
                value={topic}
                disabled={disabled || busy}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={
                  isOfficialDoc
                    ? "例如：XX局关于推进数字政务建设的意见"
                    : "例如：2026 年数字化转型工作方案"
                }
              />
            </div>
          </section>

          <section className="writing-setup-step">
            <header className="writing-setup-step-header">
              <span className="writing-setup-step-num" aria-hidden="true">
                3
              </span>
              <div className="writing-setup-step-heading">
                <h3 className="writing-setup-step-title">补充要求（可选）</h3>
                <p className="writing-setup-step-desc">
                  {isOfficialDoc
                    ? "填写机关名称、会议名称、日期、政策依据等，将纳入大纲"
                    : "填写字数、受众、必须包含的章节等约束条件"}
                </p>
              </div>
            </header>
            <div className="writing-setup-step-body">
              <input
                className="writing-input"
                value={extraNotes}
                disabled={disabled || busy}
                onChange={(event) => setExtraNotes(event.target.value)}
                placeholder={
                  isOfficialDoc
                    ? "例如：河北农业大学 2025.7.25 校党委一次会议"
                    : "例如：3000 字以内，面向局领导汇报"
                }
              />

              <div className="writing-action-panel">
                <div className="writing-action-panel-label">开始写作</div>
                <div className="writing-action-grid writing-action-grid--3">
                  <button type="button" className="writing-primary-btn writing-action-btn" disabled={disabled || busy} onClick={() => void handleGenerateOutline()}>
                    {busy && loadingNote.includes("大纲") ? "生成中…" : "AI 生成大纲"}
                  </button>
                  <button type="button" className="writing-secondary-btn writing-action-btn" disabled={disabled || busy} onClick={() => void handleUseTemplateSkeleton()}>
                    使用模板骨架
                  </button>
                  <button type="button" className="writing-secondary-btn writing-action-btn" disabled={disabled || busy} onClick={() => void handleAnalyzeDocument()}>
                    {busy && loadingNote.includes("分析") ? "分析中…" : "从 Word 续写"}
                  </button>
                </div>
              </div>
              {renderLoadingBanner()}
            </div>
          </section>
        </div>
      )}

      {localProject && phase === "outline" && (
        <section className="writing-section">
          <div className="writing-section-head">
            <h3>{localProject.title}</h3>
            <span>{localProject.outline.length} 节</span>
          </div>

          <OutlineEditor sections={localProject.outline} disabled={disabled || busy} onChange={(outline) => void handleOutlineChange(outline)} />

          <div className="writing-field-block">
            <label className="writing-label">补充要求（可选）</label>
            <input
              className="writing-input"
              value={extraNotes}
              disabled={disabled || busy}
              onChange={(event) => {
                const value = event.target.value;
                setExtraNotes(value);
                if (localProject) {
                  void persistProject({ ...localProject, extraNotes: value, updatedAt: Date.now() });
                }
              }}
              placeholder="机关名称、会议名称、日期、政策依据等，重新生成大纲时会纳入"
            />
          </div>

          {renderLoadingBanner(true)}

          <div className="writing-action-panel">
            <div className="writing-action-panel-label">生成与导出</div>
            <div className="writing-action-grid">
              <button
                type="button"
                className="writing-primary-btn writing-action-btn"
                disabled={disabled || busy}
                onClick={() => void handleGenerateFullDocument()}
              >
                {busy ? "生成中…" : "一键生成全文并插入"}
              </button>
              <button
                type="button"
                className="writing-secondary-btn writing-action-btn"
                disabled={disabled || busy}
                onClick={() => void handleStartWriting()}
              >
                分节撰写
              </button>
              <button
                type="button"
                className="writing-ghost-btn writing-action-btn"
                disabled={disabled || busy}
                onClick={() => void handleGenerateOutline()}
              >
                {busy && loadingNote.includes("大纲") ? "生成中…" : "重新生成大纲"}
              </button>
              <button
                type="button"
                className="writing-ghost-btn writing-action-btn"
                disabled={disabled || busy}
                onClick={() => void handleSaveAsTemplate()}
              >
                存为模板
              </button>
            </div>
            <p className="writing-action-panel-hint">
              「一键生成」会依次撰写各章节并插入到 Word 光标处，随后可在文档中或上方大纲逐节修改。
            </p>
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

          {renderLoadingBanner(true)}

          {!busy || !loadingNote ? (
            <div className="writing-action-panel writing-action-panel--compact">
              <button type="button" className="writing-primary-btn writing-action-btn writing-action-btn--full" disabled={disabled || busy} onClick={() => void handleGenerateFullDocument()}>
                一键生成全文并插入
              </button>
            </div>
          ) : null}

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

              {(currentPreviewContent || isStreamingCurrentSection) && (
                <div className="writing-preview">
                  {currentPreviewContent || (isStreamingCurrentSection ? "生成中…" : "")}
                </div>
              )}

              {!currentPreviewContent && !isStreamingCurrentSection && (
                <p className="writing-preview-empty">本节尚未生成，点击「生成本节」开始撰写。</p>
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
            <div className="writing-action-panel">
              <div className="writing-action-panel-label">统稿与导出</div>
              <div className="writing-action-grid writing-action-grid--3">
                <button type="button" className="writing-secondary-btn writing-action-btn" disabled={disabled || busy} onClick={() => void handleFullReview()}>
                  全文统稿
                </button>
                <button type="button" className="writing-secondary-btn writing-action-btn" disabled={disabled || busy} onClick={() => void handleInsertAllSections()}>
                  插入全部章节
                </button>
                <button type="button" className="writing-ghost-btn writing-action-btn" disabled={disabled || busy} onClick={() => void handleSaveAsTemplate()}>
                  存为模板
                </button>
              </div>
            </div>
          </section>

          <OutlineEditor sections={localProject.outline} disabled={disabled || busy} onChange={(outline) => void handleOutlineChange(outline)} />
        </>
      )}
    </div>
  );
}
