import React, { useEffect, useRef, useState } from "react";
import { ChatSession } from "../types";
import { formatSessionTime } from "../services/storageService";

interface SessionSwitcherProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  disabled?: boolean;
  dropUp?: boolean;
  onSwitch: (sessionId: string) => void;
  onRename?: (sessionId: string, title: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onDelete: (sessionId: string) => void;
}

export function SessionSwitcher({
  sessions,
  activeSessionId,
  disabled,
  dropUp,
  onSwitch,
  onRename = () => undefined,
  onReorder = () => undefined,
  onDelete,
}: SessionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setEditingId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleSwitch = (sessionId: string) => {
    if (editingId) return;
    onSwitch(sessionId);
    setOpen(false);
  };

  const startRename = (event: React.MouseEvent, item: ChatSession) => {
    event.stopPropagation();
    setEditingId(item.id);
    setEditValue(item.title);
  };

  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
    setEditValue("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleDelete = (event: React.MouseEvent, sessionId: string) => {
    event.stopPropagation();
    onDelete(sessionId);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, sessionId: string) => {
    if (editingId || disabled) {
      event.preventDefault();
      return;
    }
    setDraggingId(sessionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sessionId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, sessionId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === sessionId) return;
    setDragOverId(sessionId);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) return;

    const ids = sessions.map((session) => session.id);
    const fromIndex = ids.indexOf(draggingId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextIds = [...ids];
    nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, draggingId);
    onReorder(nextIds);

    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div className={`session-switcher${dropUp ? " drop-up" : ""}`} ref={rootRef}>
      <button
        className="icon-btn"
        title="历史会话"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 4.5h11M4 2.5v2M12 2.5v2M3 6.5h10v7H3v-7z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="session-dropdown">
          <div className="session-dropdown-title">历史会话</div>
          <div className="session-list">
            {sessions.length === 0 && <div className="session-empty">暂无历史会话</div>}
            {sessions.map((item) => {
              const isActive = item.id === activeSessionId;
              const isEditing = editingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`session-item${isActive ? " active" : ""}${
                    draggingId === item.id ? " dragging" : ""
                  }${dragOverId === item.id ? " drag-over" : ""}`}
                  draggable={!isEditing && !disabled}
                  onDragStart={(event) => handleDragStart(event, item.id)}
                  onDragOver={(event) => handleDragOver(event, item.id)}
                  onDrop={(event) => handleDrop(event, item.id)}
                  onDragEnd={handleDragEnd}
                >
                  <button
                    type="button"
                    className="session-drag-handle"
                    title="拖动排序"
                    disabled={disabled || isEditing}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                      <circle cx="2.5" cy="2" r="0.9" />
                      <circle cx="7.5" cy="2" r="0.9" />
                      <circle cx="2.5" cy="5" r="0.9" />
                      <circle cx="7.5" cy="5" r="0.9" />
                      <circle cx="2.5" cy="8" r="0.9" />
                      <circle cx="7.5" cy="8" r="0.9" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className="session-item-body"
                    onClick={() => handleSwitch(item.id)}
                    disabled={disabled || isEditing}
                  >
                    <div className="session-item-main">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          className="session-rename-input"
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitRename();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          onBlur={commitRename}
                        />
                      ) : (
                        <span className="session-item-title">{item.title}</span>
                      )}
                      <span className="session-item-time">{formatSessionTime(item.updatedAt)}</span>
                    </div>
                  </button>

                  <div className="session-item-actions">
                    <button
                      type="button"
                      className="session-action-btn"
                      title="重命名"
                      disabled={disabled}
                      onClick={(event) => startRename(event, item)}
                    >
                      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                          d="M11.2 2.8l2 2-7.2 7.2H4v-2l7.2-7.2z"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        className="session-action-btn danger"
                        title="删除会话"
                        disabled={disabled}
                        onClick={(event) => handleDelete(event, item.id)}
                      >
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M3.5 4.5h9M6 4.5V3.5h4v1M5 4.5l.5 8h5l.5-8"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
