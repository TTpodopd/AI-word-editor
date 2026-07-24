import React, { useMemo, useState } from "react";
import { AppSettings, WritingTemplate, WritingTemplateCategoryId } from "../types";
import {
  duplicateWritingTemplate,
  filterWritingTemplates,
  getActiveWritingTemplateCategories,
  getAllWritingTemplates,
  getWritingTemplateCategory,
  getWritingTemplateCategoryLabel,
} from "../prompts/writing/templates";
import {
  addCustomWritingTemplate,
  createEmptyWritingTemplate,
  removeWritingTemplate,
} from "../services/writingTemplateStorage";
import { WritingTemplateEditorDialog } from "./WritingTemplateEditorDialog";

interface WritingTemplatePickerProps {
  templates: WritingTemplate[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (templateId: string) => void;
  onSettingsChange: (settings: AppSettings) => void;
  onNotify: (text: string) => void;
}

type CategoryFilter = WritingTemplateCategoryId | "all";

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M8.8 2.2l3 3L5.1 11.9l-3.3.4.4-3.3L8.8 2.2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M6 6.5v3M8 6.5v3M4 4l.5 7a1 1 0 001 .9h3a1 1 0 001-.9L10 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WritingTemplatePicker({
  templates,
  selectedId,
  disabled,
  onSelect,
  onSettingsChange,
  onNotify,
}: WritingTemplatePickerProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WritingTemplate | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | "duplicate">("create");

  const activeCategories = useMemo(() => getActiveWritingTemplateCategories(templates), [templates]);

  const filteredTemplates = useMemo(
    () => filterWritingTemplates(templates, { categoryId: categoryFilter, query }),
    [templates, categoryFilter, query]
  );

  const selectedTemplate = templates.find((item) => item.id === selectedId);

  const openCreateDialog = () => {
    setEditingTemplate(createEmptyWritingTemplate());
    setEditorMode("create");
    setEditorOpen(true);
  };

  const openEditDialog = (template: WritingTemplate) => {
    setEditingTemplate({
      ...template,
      outlineSkeleton: template.outlineSkeleton.map((item) => ({ ...item })),
    });
    setEditorMode(template.builtin ? "duplicate" : "edit");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
    setEditorMode("create");
  };

  const handleSaveTemplate = async (draft: WritingTemplate) => {
    const savingAsCopy = editorMode === "duplicate";
    const toSave = savingAsCopy ? duplicateWritingTemplate(draft, { name: draft.name.trim() || draft.name }) : draft;
    const nextSettings = await addCustomWritingTemplate(toSave);
    onSettingsChange(nextSettings);
    onSelect(toSave.id);
    onNotify(
      editorMode === "create"
        ? `已创建模板「${toSave.name}」`
        : savingAsCopy
          ? `已另存为自定义模板「${toSave.name}」`
          : `已更新模板「${toSave.name}」`
    );
    closeEditor();
  };

  const handleDeleteTemplate = async (template: WritingTemplate, event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    if (!window.confirm(`确定删除模板「${template.name}」？`)) return;

    const nextSettings = await removeWritingTemplate(template);
    onSettingsChange(nextSettings);

    if (selectedId === template.id) {
      const remaining = getAllWritingTemplates(nextSettings);
      if (remaining.length > 0) {
        onSelect(remaining[0].id);
      }
    }

    onNotify(`已删除模板「${template.name}」`);
  };

  return (
    <>
      <div className="writing-template-picker">
        <div className="writing-template-picker-toolbar">
          <div className="writing-template-picker-toolbar-row">
            <input
              className="writing-template-search"
              type="search"
              value={query}
              disabled={disabled}
              placeholder="搜索模板名称或描述"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              className="writing-template-add-btn"
              disabled={disabled}
              onClick={openCreateDialog}
            >
              <span aria-hidden="true">+</span>
              新建模板
            </button>
          </div>

          <div className="writing-template-categories" role="tablist" aria-label="模板分类">
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === "all"}
              className={`writing-template-category${categoryFilter === "all" ? " active" : ""}`}
              disabled={disabled}
              onClick={() => setCategoryFilter("all")}
            >
              全部
              <span>{templates.length}</span>
            </button>
            {activeCategories.map((category) => {
              const count = templates.filter((item) => getWritingTemplateCategory(item) === category.id).length;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={categoryFilter === category.id}
                  className={`writing-template-category${categoryFilter === category.id ? " active" : ""}`}
                  disabled={disabled}
                  onClick={() => setCategoryFilter(category.id)}
                >
                  {category.label}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredTemplates.length === 0 ? (
          <p className="writing-template-picker-empty">未找到匹配的模板，请调整搜索或分类筛选。</p>
        ) : (
          <div className="writing-template-grid" role="listbox" aria-label="写作模板">
            {filteredTemplates.map((template) => {
              const selected = template.id === selectedId;
              const category = getWritingTemplateCategory(template);
              const isCustom = !template.builtin;
              return (
                <div
                  key={template.id}
                  role="option"
                  aria-selected={selected}
                  className={`writing-template-card${selected ? " selected" : ""}${isCustom ? " custom" : ""}`}
                >
                  <button
                    type="button"
                    className="writing-template-card-main"
                    disabled={disabled}
                    onClick={() => onSelect(template.id)}
                  >
                    <div className="writing-template-card-head">
                      <span className="writing-template-card-name">{template.name}</span>
                    </div>
                    <span className="writing-template-card-badge">
                      {isCustom ? "自定义" : getWritingTemplateCategoryLabel(category)}
                    </span>
                    <span className="writing-template-card-desc">{template.description}</span>
                    <span className="writing-template-card-meta">{template.outlineSkeleton.length} 节骨架</span>
                  </button>

                  <div className="writing-template-card-actions">
                    <button
                      type="button"
                      className="writing-template-card-action"
                      disabled={disabled}
                      title={template.builtin ? "自定义此模板" : "编辑模板"}
                      aria-label={template.builtin ? "自定义此模板" : "编辑模板"}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditDialog(template);
                      }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="writing-template-card-action danger"
                      disabled={disabled}
                      title="删除模板"
                      aria-label="删除模板"
                      onClick={(event) => void handleDeleteTemplate(template, event)}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedTemplate && (
          <div className="writing-template-detail">
            <div className="writing-template-detail-main">
              <strong>{selectedTemplate.name}</strong>
              <span>{selectedTemplate.description}</span>
            </div>
            <div className="writing-template-detail-actions">
              <span className="writing-template-detail-meta">
                {selectedTemplate.builtin ? getWritingTemplateCategoryLabel(getWritingTemplateCategory(selectedTemplate)) : "自定义"} ·{" "}
                {selectedTemplate.outlineSkeleton.length} 节
              </span>
              <button
                type="button"
                className="writing-secondary-btn writing-template-detail-edit-btn"
                disabled={disabled}
                onClick={() => openEditDialog(selectedTemplate)}
              >
                {selectedTemplate.builtin ? "自定义此模板" : "编辑模板"}
              </button>
            </div>
          </div>
        )}
      </div>

      <WritingTemplateEditorDialog
        open={editorOpen}
        template={editingTemplate}
        mode={editorMode}
        disabled={disabled}
        onClose={closeEditor}
        onSave={handleSaveTemplate}
      />
    </>
  );
}
