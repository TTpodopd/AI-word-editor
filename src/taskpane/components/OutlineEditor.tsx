import React, { useState } from "react";
import { WritingOutlineSection, createId } from "../types";

interface OutlineEditorProps {
  sections: WritingOutlineSection[];
  disabled?: boolean;
  onChange: (sections: WritingOutlineSection[]) => void;
}

const LEVEL_OPTIONS: Array<{ value: 1 | 2 | 3; label: string; short: string }> = [
  { value: 1, label: "一级标题", short: "一" },
  { value: 2, label: "二级标题", short: "二" },
  { value: 3, label: "三级标题", short: "三" },
];

function DragHandleIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.2" />
      <circle cx="7.5" cy="2.5" r="1.2" />
      <circle cx="2.5" cy="8" r="1.2" />
      <circle cx="7.5" cy="8" r="1.2" />
      <circle cx="2.5" cy="13.5" r="1.2" />
      <circle cx="7.5" cy="13.5" r="1.2" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M6 6.5v3M8 6.5v3M4 4l.5 7a1 1 0 001 .9h3a1 1 0 001-.9L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OutlineEditor({ sections, disabled, onChange }: OutlineEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const updateSection = (id: string, patch: Partial<WritingOutlineSection>) => {
    onChange(sections.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  };

  const removeSection = (id: string) => {
    if (sections.length <= 1) return;
    onChange(sections.filter((section) => section.id !== id));
  };

  const addSection = () => {
    onChange([
      ...sections,
      {
        id: createId(),
        level: 1,
        title: "新章节",
        brief: "请填写本节写作要点",
        status: "pending",
      },
    ]);
  };

  const reorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const next = [...sections];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <div className="writing-outline-editor">
      <div className="writing-outline-header">
        <div className="writing-outline-header-left">
          <span className="writing-outline-title">大纲编辑</span>
          <span className="writing-outline-count">{sections.length} 节</span>
        </div>
        <button type="button" className="writing-outline-add-btn" onClick={addSection} disabled={disabled}>
          <span aria-hidden="true">+</span>
          添加章节
        </button>
      </div>

      <div className="writing-outline-list">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={[
              "writing-outline-item",
              `level-${section.level}`,
              dragIndex === index ? "dragging" : "",
              dropIndex === index && dragIndex !== null && dragIndex !== index ? "drop-target" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            draggable={!disabled}
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                setDropIndex(index);
              }
            }}
            onDragLeave={() => setDropIndex(null)}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, index);
              setDragIndex(null);
              setDropIndex(null);
            }}
          >
            <div className="writing-outline-item-inner">
              <button
                type="button"
                className="writing-outline-drag"
                aria-label="拖拽排序"
                disabled={disabled}
                tabIndex={-1}
              >
                <DragHandleIcon />
              </button>

              <span className="writing-outline-index">{index + 1}</span>

              <div className="writing-outline-fields">
                <div className="writing-outline-row">
                  <div className="writing-outline-level-group" role="group" aria-label="标题层级">
                    {LEVEL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`writing-level-pill${section.level === option.value ? " active" : ""}`}
                        disabled={disabled}
                        title={option.label}
                        onClick={() => updateSection(section.id, { level: option.value })}
                      >
                        {option.short}
                      </button>
                    ))}
                  </div>

                  <input
                    className="writing-outline-input writing-outline-title-input"
                    value={section.title}
                    disabled={disabled}
                    onChange={(event) => updateSection(section.id, { title: event.target.value })}
                    placeholder="章节标题"
                  />

                  <button
                    type="button"
                    className="writing-outline-delete"
                    onClick={() => removeSection(section.id)}
                    disabled={disabled || sections.length <= 1}
                    aria-label="删除章节"
                    title="删除章节"
                  >
                    <DeleteIcon />
                  </button>
                </div>

                <textarea
                  className="writing-outline-brief"
                  value={section.brief}
                  disabled={disabled}
                  rows={2}
                  onChange={(event) => updateSection(section.id, { brief: event.target.value })}
                  placeholder="本节写作要点（可选）"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
