import { useCallback, useEffect, useRef, useState } from "react";
import { SelectionState } from "../types";
import { readCurrentSelection } from "../services/wordService";

const DEBOUNCE_MS = 150;

export function useSelection() {
  const [selection, setSelection] = useState<SelectionState>({
    hasSelection: false,
    text: "",
    charCount: 0,
  });
  const [ready, setReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const refreshSelection = useCallback(async () => {
    try {
      const result = await readCurrentSelection();
      setSelection({
        hasSelection: result.hasSelection,
        text: result.text,
        charCount: result.charCount,
      });
    } catch {
      setSelection({ hasSelection: false, text: "", charCount: 0 });
    }
  }, []);

  useEffect(() => {
    Office.onReady((info) => {
      if (info.host === Office.HostType.Word) {
        setReady(true);
        refreshSelection();

        Office.context.document.addHandlerAsync(
          Office.EventType.DocumentSelectionChanged,
          () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(refreshSelection, DEBOUNCE_MS);
          }
        );
      }
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshSelection]);

  return { selection, ready, refreshSelection };
}
