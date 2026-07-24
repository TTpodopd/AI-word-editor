import React, { useEffect, useState } from "react";
import { WritingOutlineSection, WritingTemplate, WritingTemplateCategoryId } from "../types";
import { WRITING_TEMPLATE_CATEGORIES, outlineToTemplateSkeleton, templateSkeletonToOutline } from "../prompts/writing/templates";
import { OutlineEditor } from "./OutlineEditor";

interface WritingTemplateEditorDialogProps {
  open: boolean;
  template: WritingTemplate | null;
  mode?: "create" | "edit" | "duplicate";
  disabled?: boolean;
  onClose: () => void;
  onSave: (template: WritingTemplate) => void | Promise<void>;
}

export function WritingTemplateEditorDialog({
  open,
  template,
  mode = "edit",
  disabled,
  onClose,
  onSave,
}: WritingTemplateEditorDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WritingTemplateCategoryId>("custom");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [sectionRules, setSectionRules] = useState("");
  const [outlineSections, setOutlineSections] = useState<WritingOutlineSection[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    setName(template.name);
    setDescription(template.description);
    setCategory(template.category || "custom");
    setSystemPrompt(template.systemPrompt);
    setSectionRules(template.sectionRules);
    setOutlineSections(templateSkeletonToOutline(template.outlineSkeleton));
    setSubmitting(false);
  }, [open, template]);

  if (!open || !template) return null;

  const dialogTitle =
    mode === "create" ? "新建模板" : mode === "duplicate" ? `自定义「${template.name}」` : "编辑模板";
  const saveLabel =
    mode === "create" ? "创建模板" : mode === "duplicate" ? "另存为自定义模板" : "保存修改";

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || submitting || disabled) {
      return;
    }

    const outlineSkeleton = outlineToTemplateSkeleton(outlineSections);
    if (outlineSkeleton.length === 0) {
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        ...template,
        name: trimmedName,
        description: description.trim(),
        category,
        builtin: false,
        outlineSkeleton,
        systemPrompt: systemPrompt.trim() || "你是一位专业的文档写作助手。",
        sectionRules: sectionRules.trim() || "直接输出正文，不要 Markdown 标记。",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="writing-template-dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="writing-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="writing-template-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="writing-template-dialog-header">
          <div>
            <h3 id="writing-template-dialog-title" className="writing-template-dialog-title">
              {dialogTitle}
            </h3>
            {mode === "duplicate" && (
              <p className="writing-template-dialog-subtitle">内置模板将另存为自定义模板，不影响原模板。</p>
            )}
          </div>
          <button type="button" className="writing-template-dialog-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="writing-template-dialog-body">
          <label className="writing-template-dialog-field">
            <span>模板名称</span>
            <input
              className="writing-template-dialog-input"
              value={name}
              disabled={disabled || submitting}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：部门工作总结"
            />
          </label>

          <label className="writing-template-dialog-field">
            <span>模板描述</span>
            <textarea
              className="writing-template-dialog-textarea"
              rows={2}
              value={description}
              disabled={disabled || submitting}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="简要说明适用场景"
            />
          </label>

          <label className="writing-template-dialog-field">
            <span>模板分类</span>
            <select
              className="writing-template-dialog-select"
              value={category}
              disabled={disabled || submitting}
              onChange={(event) => setCategory(event.target.value as WritingTemplateCategoryId)}
            >
              {WRITING_TEMPLATE_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="writing-template-dialog-section">
            <span className="writing-template-dialog-section-title">大纲骨架</span>
            <OutlineEditor sections={outlineSections} disabled={disabled || submitting} onChange={setOutlineSections} />
          </div>

          <label className="writing-template-dialog-field">
            <span>系统提示词</span>
            <textarea
              className="writing-template-dialog-textarea"
              rows={3}
              value={systemPrompt}
              disabled={disabled || submitting}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="定义 AI 写作角色与总体要求"
            />
          </label>

          <label className="writing-template-dialog-field">
            <span>分节写作规则</span>
            <textarea
              className="writing-template-dialog-textarea"
              rows={3}
              value={sectionRules}
              disabled={disabled || submitting}
              onChange={(event) => setSectionRules(event.target.value)}
              placeholder="定义每节输出的格式与禁忌"
            />
          </label>
        </div>

        <footer className="writing-template-dialog-actions">
          <button type="button" className="writing-ghost-btn" disabled={submitting} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="writing-primary-btn"
            disabled={disabled || submitting || !name.trim() || outlineSections.length === 0}
            onClick={() => void handleSave()}
          >
            {submitting ? "保存中…" : saveLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
