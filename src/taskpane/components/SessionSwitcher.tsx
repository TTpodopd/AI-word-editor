import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatSession } from "../types";
import { formatSessionTime } from "../services/storageService";

const DROPDOWN_GAP = 6;
const DROPDOWN_BASE_WIDTH = 200;
const DROPDOWN_MAX_HEIGHT = 180;

interface SessionSwitcherProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  disabled?: boolean;
  dropUp?: boolean;
  onSwitch: (sessionId: string) => void;
  onRename?: (sessionId: string, title: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onDelete: (sessionId: string) => void;
  onExportSessions?: () => void | Promise<void>;
  onImportSessions?: (file: File) => void | Promise<string | null>;
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
  onExportSessions,
  onImportSessions,
}: SessionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [importing, setImporting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef<string | null>(null);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const updateDropdownPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const paneWidth = window.innerWidth;
    const paneHeight = window.innerHeight;
    const scale =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
    const width = Math.min(DROPDOWN_BASE_WIDTH * scale, paneWidth - 16);
    const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT * scale, paneHeight - 24);
    let left = rect.left;

    if (left + width > paneWidth - 8) {
      left = Math.max(8, paneWidth - width - 8);
    }

    if (dropUp) {
      setDropdownStyle({
        position: "fixed",
        left: `${left}px`,
        bottom: `${paneHeight - rect.top + DROPDOWN_GAP}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
      });
      return;
    }

    setDropdownStyle({
      position: "fixed",
      left: `${left}px`,
      top: `${rect.bottom + DROPDOWN_GAP}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
    });
  }, [dropUp]);

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setEditingId(null);
    };

    const handleReposition = () => updateDropdownPosition();

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReposition);

    const observer = new ResizeObserver(handleReposition);
    observer.observe(document.documentElement);
    if (rootRef.current) {
      observer.observe(rootRef.current);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReposition);
      observer.disconnect();
    };
  }, [open, updateDropdownPosition]);

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

  const handleExport = async () => {
    if (!onExportSessions || disabled || importing) return;
    await onExportSessions();
    setOpen(false);
  };

  const handleImportClick = () => {
    if (!onImportSessions || disabled || importing) return;
    importInputRef.current?.click();
  };

  const handleImportSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onImportSessions) return;

    setImporting(true);
    try {
      await onImportSessions(file);
      setOpen(false);
    } finally {
      setImporting(false);
    }
  };

  const commitReorder = useCallback(
    (dragId: string, targetId: string) => {
      if (dragId === targetId) return;

      const ids = sessionsRef.current.map((session) => session.id);
      const fromIndex = ids.indexOf(dragId);
      const toIndex = ids.indexOf(targetId);
      if (fromIndex < 0 || toIndex < 0) return;

      const nextIds = [...ids];
      nextIds.splice(fromIndex, 1);
      nextIds.splice(toIndex, 0, dragId);
      onReorder(nextIds);
    },
    [onReorder]
  );

  const finishDrag = useCallback(() => {
    draggingRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    document.body.classList.remove("session-dragging");
  }, []);

  const dragListenersRef = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
  } | null>(null);

  const cleanupDragListeners = useCallback(() => {
    const listeners = dragListenersRef.current;
    if (!listeners) return;

    document.removeEventListener("pointermove", listeners.onMove);
    document.removeEventListener("pointerup", listeners.onUp);
    document.removeEventListener("pointercancel", listeners.onUp);
    dragListenersRef.current = null;
  }, []);

  useEffect(() => () => cleanupDragListeners(), [cleanupDragListeners]);

  const handleDragHandlePointerDown = (
    event: React.PointerEvent<HTMLSpanElement>,
    sessionId: string
  ) => {
    if (editingId || disabled) return;

    event.preventDefault();
    event.stopPropagation();
    cleanupDragListeners();

    draggingRef.current = sessionId;
    setDraggingId(sessionId);
    document.body.classList.add("session-dragging");

    const onMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;

      const target = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>("[data-session-id]");
      const targetId = target?.dataset.sessionId;

      if (targetId && targetId !== draggingRef.current) {
        setDragOverId(targetId);
      }
    };

    const onUp = (upEvent: PointerEvent) => {
      if (!draggingRef.current) return;

      const dragId = draggingRef.current;
      const target = document
        .elementFromPoint(upEvent.clientX, upEvent.clientY)
        ?.closest<HTMLElement>("[data-session-id]");
      const targetId = target?.dataset.sessionId;

      if (targetId) {
        commitReorder(dragId, targetId);
      }

      cleanupDragListeners();
      finishDrag();
    };

    dragListenersRef.current = { onMove, onUp };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
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

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`session-dropdown session-dropdown--anchored${dropUp ? " drop-up" : ""}`}
            style={dropdownStyle}
          >
            <div className="session-dropdown-title">历史会话</div>
            <div className="session-list">
              {sessions.length === 0 && <div className="session-empty">暂无历史会话</div>}
              {sessions.map((item) => {
                const isActive = item.id === activeSessionId;
                const isEditing = editingId === item.id;

                return (
                  <div
                    key={item.id}
                    data-session-id={item.id}
                    className={`session-item${isActive ? " active" : ""}${
                      draggingId === item.id ? " dragging" : ""
                    }${dragOverId === item.id ? " drag-over" : ""}`}
                  >
                    <span
                      className="session-drag-handle"
                      title="拖动排序"
                      aria-label="拖动排序"
                      onPointerDown={(event) => handleDragHandlePointerDown(event, item.id)}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                        <circle cx="2.5" cy="2" r="0.9" />
                        <circle cx="7.5" cy="2" r="0.9" />
                        <circle cx="2.5" cy="5" r="0.9" />
                        <circle cx="7.5" cy="5" r="0.9" />
                        <circle cx="2.5" cy="8" r="0.9" />
                        <circle cx="7.5" cy="8" r="0.9" />
                      </svg>
                    </span>

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
            {(onExportSessions || onImportSessions) && (
              <div className="session-dropdown-footer">
                {onExportSessions && (
                  <button
                    type="button"
                    className="session-transfer-btn"
                    disabled={disabled || importing}
                    onClick={() => void handleExport()}
                  >
                    导出 JSON
                  </button>
                )}
                {onImportSessions && (
                  <button
                    type="button"
                    className="session-transfer-btn"
                    disabled={disabled || importing}
                    onClick={handleImportClick}
                  >
                    {importing ? "导入中…" : "导入合并"}
                  </button>
                )}
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="session-import-input"
                  onChange={(event) => void handleImportSelected(event)}
                />
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
