import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatBottomActionId } from "../constants/chatBottomActions";
import { OutputStyleId } from "../prompts/outputStylePresets";
import { OutputStylePicker } from "./OutputStylePicker";

interface ChatBottomActionsProps {
  actionOrder: ChatBottomActionId[];
  disabled?: boolean;
  webSearchEnabled?: boolean;
  outputStyleId: OutputStyleId;
  onOutputStyleChange: (styleId: OutputStyleId) => void;
  onReorderActions: (order: ChatBottomActionId[]) => void;
  onToggleWebSearch: () => void;
  onOpenSettings: () => void;
}

const DRAG_THRESHOLD_PX = 5;

function computePreviewOrder(
  order: ChatBottomActionId[],
  dragId: ChatBottomActionId,
  targetId: ChatBottomActionId | null
): ChatBottomActionId[] {
  if (!targetId || dragId === targetId) {
    return order;
  }

  const ids = [...order];
  const fromIndex = ids.indexOf(dragId);
  const toIndex = ids.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0) {
    return order;
  }

  ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, dragId);
  return ids;
}

function findDropTargetByPoint(
  clientX: number,
  clientY: number,
  dragId: ChatBottomActionId,
  order: ChatBottomActionId[],
  itemElements: Map<ChatBottomActionId, HTMLDivElement>
): ChatBottomActionId | null {
  for (const id of order) {
    if (id === dragId) continue;
    const element = itemElements.get(id);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return id;
    }
  }

  let nearestId: ChatBottomActionId | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const id of order) {
    if (id === dragId) continue;
    const element = itemElements.get(id);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = id;
    }
  }

  return nearestDistance <= 36 ? nearestId : null;
}

function ActionGhostIcon({ actionId }: { actionId: ChatBottomActionId }) {
  switch (actionId) {
    case "webSearch":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M1.5 8h13M8 1.8c-1.8 2-2.8 4.2-2.8 6.2S6.2 12.2 8 14.2c1.8-2 2.8-4.2 2.8-6.2S9.8 3.8 8 1.8z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "outputStyle":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.8 4.2c0-1 .8-1.8 1.8-1.8h6.8c1 0 1.8.8 1.8 1.8v3.8c0 1-.8 1.8-1.8 1.8H7.2L3.8 13v-2.8c-1 0-1.8-.8-1.8-1.8V4.2z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M5.2 6.2h5.6M5.2 8.1h4"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </svg>
      );
    case "settings":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.2" />
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="8" cy="13" r="1.2" />
        </svg>
      );
    default:
      return null;
  }
}

function clearItemTransforms(items: Map<ChatBottomActionId, HTMLDivElement>) {
  for (const element of items.values()) {
    element.style.transition = "";
    element.style.transform = "";
  }
}

export function ChatBottomActions({
  actionOrder,
  disabled,
  webSearchEnabled,
  outputStyleId,
  onOutputStyleChange,
  onReorderActions,
  onToggleWebSearch,
  onOpenSettings,
}: ChatBottomActionsProps) {
  const [draggingId, setDraggingId] = useState<ChatBottomActionId | null>(null);
  const [dragOverId, setDragOverId] = useState<ChatBottomActionId | null>(null);
  const [previewOrder, setPreviewOrder] = useState<ChatBottomActionId[]>(actionOrder);
  const draggingRef = useRef<ChatBottomActionId | null>(null);
  const suppressClickRef = useRef(false);
  const orderRef = useRef(actionOrder);
  const previewOrderRef = useRef(actionOrder);
  const dragTargetRef = useRef<ChatBottomActionId | null>(null);
  const itemElementsRef = useRef<Map<ChatBottomActionId, HTMLDivElement>>(new Map());
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragListenersRef = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
  } | null>(null);

  useEffect(() => {
    orderRef.current = actionOrder;
    if (!draggingId) {
      previewOrderRef.current = actionOrder;
      setPreviewOrder(actionOrder);
    }
  }, [actionOrder, draggingId]);

  const cleanupDragListeners = useCallback(() => {
    const listeners = dragListenersRef.current;
    if (!listeners) return;

    document.removeEventListener("pointermove", listeners.onMove);
    document.removeEventListener("pointerup", listeners.onUp);
    document.removeEventListener("pointercancel", listeners.onUp);
    dragListenersRef.current = null;
  }, []);

  useEffect(() => () => cleanupDragListeners(), [cleanupDragListeners]);

  const updateGhostPosition = (clientX: number, clientY: number) => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%) scale(1.06)`;
  };

  const finishDrag = useCallback(() => {
    draggingRef.current = null;
    dragTargetRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    setPreviewOrder(orderRef.current);
    previewOrderRef.current = orderRef.current;
    clearItemTransforms(itemElementsRef.current);
    document.body.classList.remove("chat-bottom-actions-dragging");
  }, []);

  const commitReorder = useCallback(
    (dragId: ChatBottomActionId, targetId: ChatBottomActionId) => {
      if (dragId === targetId) return;

      const ids = [...orderRef.current];
      const fromIndex = ids.indexOf(dragId);
      const toIndex = ids.indexOf(targetId);
      if (fromIndex < 0 || toIndex < 0) return;

      ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, dragId);
      onReorderActions(ids);
    },
    [onReorderActions]
  );

  const updateDragPreview = (clientX: number, clientY: number, dragId: ChatBottomActionId) => {
    updateGhostPosition(clientX, clientY);

    const targetId = findDropTargetByPoint(
      clientX,
      clientY,
      dragId,
      previewOrderRef.current,
      itemElementsRef.current
    );

    if (targetId === dragTargetRef.current) {
      return;
    }

    dragTargetRef.current = targetId;
    const nextPreview = computePreviewOrder(orderRef.current, dragId, targetId);
    previewOrderRef.current = nextPreview;
    setDragOverId(targetId);
    setPreviewOrder(nextPreview);
  };

  const handleItemPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    actionId: ChatBottomActionId
  ) => {
    if (disabled || event.button !== 0) return;

    cleanupDragListeners();

    const itemElement = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragStarted && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      if (!dragStarted) {
        dragStarted = true;
        draggingRef.current = actionId;
        dragTargetRef.current = null;
        setDraggingId(actionId);
        setPreviewOrder([...orderRef.current]);
        previewOrderRef.current = [...orderRef.current];
        document.body.classList.add("chat-bottom-actions-dragging");
        itemElement.setPointerCapture(moveEvent.pointerId);
        moveEvent.preventDefault();
        requestAnimationFrame(() => {
          updateGhostPosition(moveEvent.clientX, moveEvent.clientY);
        });
      }

      updateDragPreview(moveEvent.clientX, moveEvent.clientY, actionId);
    };

    const onUp = (upEvent: PointerEvent) => {
      cleanupDragListeners();

      if (itemElement.hasPointerCapture(upEvent.pointerId)) {
        itemElement.releasePointerCapture(upEvent.pointerId);
      }

      if (dragStarted && draggingRef.current) {
        const targetId = findDropTargetByPoint(
          upEvent.clientX,
          upEvent.clientY,
          draggingRef.current,
          previewOrderRef.current,
          itemElementsRef.current
        );

        if (targetId) {
          commitReorder(draggingRef.current, targetId);
        }

        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      finishDrag();
    };

    dragListenersRef.current = { onMove, onUp };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };

  const renderAction = (actionId: ChatBottomActionId) => {
    switch (actionId) {
      case "webSearch":
        return (
          <button
            className={`icon-btn web-search-toggle${webSearchEnabled ? " active" : ""}`}
            title={webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
            onClick={onToggleWebSearch}
            disabled={disabled || !!draggingId}
            aria-pressed={!!webSearchEnabled}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M1.5 8h13M8 1.8c-1.8 2-2.8 4.2-2.8 6.2S6.2 12.2 8 14.2c1.8-2 2.8-4.2 2.8-6.2S9.8 3.8 8 1.8z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        );
      case "outputStyle":
        return (
          <OutputStylePicker
            value={outputStyleId}
            disabled={disabled || !!draggingId}
            onChange={onOutputStyleChange}
          />
        );
      case "settings":
        return (
          <button className="icon-btn" title="设置" onClick={onOpenSettings} disabled={disabled || !!draggingId}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.2" />
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="8" cy="13" r="1.2" />
            </svg>
          </button>
        );
      default:
        return null;
    }
  };

  const displayOrder = draggingId ? previewOrder : actionOrder;

  return (
    <>
      <div
        className={`chat-bottom-actions${draggingId ? " is-dragging" : ""}`}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {displayOrder.map((actionId) => {
          if (draggingId && actionId === draggingId) {
            return (
              <div
                key={actionId}
                ref={(element) => {
                  if (element) {
                    itemElementsRef.current.set(actionId, element);
                  } else {
                    itemElementsRef.current.delete(actionId);
                  }
                }}
                className="chat-bottom-action-item placeholder"
                data-bottom-action-id={actionId}
                aria-hidden="true"
              />
            );
          }

          return (
            <div
              key={actionId}
              ref={(element) => {
                if (element) {
                  itemElementsRef.current.set(actionId, element);
                } else {
                  itemElementsRef.current.delete(actionId);
                }
              }}
              className={`chat-bottom-action-item${
                dragOverId === actionId ? " drag-over" : ""
              }`}
              data-bottom-action-id={actionId}
              title="按住拖动可调整位置"
              onPointerDownCapture={(event) => handleItemPointerDown(event, actionId)}
            >
              {renderAction(actionId)}
            </div>
          );
        })}
      </div>

      {draggingId &&
        createPortal(
          <div ref={ghostRef} className="chat-bottom-action-ghost" aria-hidden="true">
            <div
              className={`chat-bottom-action-ghost-icon${
                draggingId === "webSearch" && webSearchEnabled ? " is-active" : ""
              }`}
            >
              <ActionGhostIcon actionId={draggingId} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
