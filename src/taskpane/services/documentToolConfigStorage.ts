import { buildDefaultToolFieldValues, DocumentToolCategory } from "../constants/documentTools";

const STORAGE_KEY = "ai-editor-document-tool-configs";
const SECTIONS_STORAGE_KEY = "ai-editor-document-tool-sections";

export type DocumentToolFieldValues = Record<string, Record<string, string>>;
export type DocumentToolSectionState = Partial<Record<DocumentToolCategory, boolean>>;

export function loadDocumentToolFieldValues(): DocumentToolFieldValues {
  const defaults = buildDefaultToolFieldValues();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as DocumentToolFieldValues;
    const merged: DocumentToolFieldValues = { ...defaults };
    for (const [toolId, fields] of Object.entries(parsed)) {
      merged[toolId] = { ...defaults[toolId], ...fields };
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function saveDocumentToolFieldValues(values: DocumentToolFieldValues): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

export function loadDocumentToolSectionState(): DocumentToolSectionState {
  try {
    const raw = localStorage.getItem(SECTIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DocumentToolSectionState;
  } catch {
    return {};
  }
}

export function saveDocumentToolSectionState(state: DocumentToolSectionState): void {
  localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(state));
}
