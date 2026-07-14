import { useCallback, useEffect, useRef, useState } from "react";
import { ensureOfficeReady } from "../services/storageService";

const INPUT_HEIGHT_KEY = "ai-editor-input-height";
const DEFAULT_HEIGHT = 72;
const MIN_HEIGHT = 56;
const MAX_HEIGHT = 280;

function clampHeight(height: number): number {
  const paneMax = Math.min(MAX_HEIGHT, Math.floor(window.innerHeight * 0.45));
  return Math.min(paneMax, Math.max(MIN_HEIGHT, Math.round(height)));
}

async function readStoredHeight(): Promise<number> {
  await ensureOfficeReady();

  let raw: string | null = null;
  try {
    if (typeof OfficeRuntime !== "undefined") {
      raw = (await OfficeRuntime.storage.getItem(INPUT_HEIGHT_KEY)) ?? null;
    }
  } catch {
    raw = null;
  }

  if (!raw) {
    try {
      raw = window.localStorage.getItem(INPUT_HEIGHT_KEY);
    } catch {
      raw = null;
    }
  }

  if (!raw) return DEFAULT_HEIGHT;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampHeight(parsed) : DEFAULT_HEIGHT;
}

async function writeStoredHeight(height: number): Promise<void> {
  await ensureOfficeReady();
  const value = String(height);

  try {
    if (typeof OfficeRuntime !== "undefined") {
      await OfficeRuntime.storage.setItem(INPUT_HEIGHT_KEY, value);
    }
  } catch {
    // ignore
  }

  try {
    window.localStorage.setItem(INPUT_HEIGHT_KEY, value);
  } catch {
    // ignore
  }
}

export function useResizableInputHeight() {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [resizing, setResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(DEFAULT_HEIGHT);
  const heightRef = useRef(DEFAULT_HEIGHT);

  useEffect(() => {
    readStoredHeight().then((stored) => {
      heightRef.current = stored;
      setHeight(stored);
    });
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = startYRef.current - event.clientY;
      const next = clampHeight(startHeightRef.current + delta);
      heightRef.current = next;
      setHeight(next);
    };

    const handlePointerUp = () => {
      setResizing(false);
      document.body.classList.remove("chat-input-resizing");
      void writeStoredHeight(heightRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.classList.remove("chat-input-resizing");
    };
  }, [resizing]);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startYRef.current = event.clientY;
      startHeightRef.current = heightRef.current;
      setResizing(true);
      document.body.classList.add("chat-input-resizing");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    []
  );

  return {
    height,
    resizing,
    handleResizeStart,
  };
}
