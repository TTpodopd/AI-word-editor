/* global Word */

import { UIMessage } from "../types";
import { isCodeActionId } from "../prompts/actions";
import { detectSelectionContentKind } from "../utils/selectionContentType";

export interface FormFillData {
  fields: Record<string, string>;
  checkboxes?: Record<string, string>;
  optionChecks?: string[];
  personnel?: Array<Record<string, string>>;
}

export interface FormScanResult {
  fieldLabels: string[];
  checkboxOptions: string[];
  hasPersonnelTable: boolean;
  hasCheckboxGroups: boolean;
  hasOptionChecks: boolean;
  documentPreview: string;
  selectionPreview: string;
}

export interface FormFillResult {
  success: boolean;
  filledCount: number;
  error?: string;
  details?: string[];
}

const KNOWN_FIELD_LABELS = [
  "技术名称",
  "申报人",
  "申报单位",
  "联系人",
  "联系电话",
  "联系邮箱",
  "联合申报单位",
  "技术水平",
  "姓名",
  "单位",
  "职务/职称",
  "职务",
  "职称",
  "学历",
  "专业方向",
];

const TECH_LEVEL_OPTIONS = [
  "国际领先",
  "国际先进",
  "国内领先",
  "国内先进",
  "填补国内空白",
  "填补省内空白",
];

const PERSONNEL_COLUMNS = ["姓名", "单位", "职务/职称", "学历", "专业方向", "联系电话"];

const UNCHECKED_MARKERS = /[□☐▢\u2610]/;
const CHECKED_MARKERS = /[☑√✓■\u2611]/;

const LABEL_ALIASES: Record<string, string> = {
  申报名称: "技术名称",
  项目名称: "技术名称",
  申请人: "申报人",
  电话: "联系电话",
  手机: "联系电话",
  邮箱: "联系邮箱",
  电子邮件: "联系邮箱",
};

let formFillScopeRange: Word.Range | null = null;

export function clearFormFillScope(): void {
  formFillScopeRange = null;
}

export function hasFormFillScope(): boolean {
  return formFillScopeRange !== null;
}

export async function captureFormFillScope(): Promise<{
  success: boolean;
  text: string;
  error?: string;
}> {
  try {
    return await Word.run(async (context) => {
      if (formFillScopeRange) {
        context.trackedObjects.remove(formFillScopeRange);
        formFillScopeRange = null;
      }

      const range = context.document.getSelection();
      range.load("text,isEmpty");
      await context.sync();

      if (range.isEmpty || !range.text?.trim()) {
        return {
          success: false,
          text: "",
          error: "请先在文档中选中需要填写的表单区域",
        };
      }

      range.track();
      context.trackedObjects.add(range);
      formFillScopeRange = range;

      return { success: true, text: range.text.trim() };
    });
  } catch (err) {
    return {
      success: false,
      text: "",
      error: err instanceof Error ? err.message : "读取选中区域失败",
    };
  }
}

export function normalizeFieldLabel(text: string): string {
  const cleaned = text
    .replace(/[\r\n]/g, "")
    .replace(/[\s\u00a0\u3000]+/g, "")
    .replace(/[：:]/g, "")
    .replace(/[_＿\-—]+/g, "")
    .trim();

  return LABEL_ALIASES[cleaned] || cleaned;
}

function isKnownFieldLabel(label: string): boolean {
  const normalized = normalizeFieldLabel(label);
  return KNOWN_FIELD_LABELS.includes(normalized);
}

function resolveFieldKey(label: string): string {
  const normalized = normalizeFieldLabel(label);
  if (normalized === "职务" || normalized === "职称") return "职务/职称";
  return normalized;
}

function extractLabelFromCellText(text: string): string | null {
  const trimmed = text.replace(/\r/g, "").trim();
  if (!trimmed) return null;

  const colonMatch = trimmed.match(/^(.+?)[：:]/);
  if (colonMatch) {
    const label = normalizeFieldLabel(colonMatch[1]);
    if (isKnownFieldLabel(label) || LABEL_ALIASES[normalizeFieldLabel(colonMatch[1])]) {
      return resolveFieldKey(colonMatch[1]);
    }
  }

  const plain = normalizeFieldLabel(trimmed);
  if (isKnownFieldLabel(plain)) return resolveFieldKey(trimmed);
  return null;
}

function isPlaceholderText(text: string): boolean {
  const trimmed = text.replace(/\r/g, "").trim();
  if (!trimmed) return true;
  return /^[_＿\-\s]+$/.test(trimmed);
}

function normalizeOptionLabel(text: string): string {
  return text.replace(/[\s\u00a0\u3000]/g, "").replace(/[_＿]+/g, "").trim();
}

function extractCheckboxOptionsFromText(text: string): string[] {
  const options: string[] = [];
  const lines = text.replace(/\r/g, "\n").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^[□☐▢\u2610☑√✓■\u2611]\s*(.+?)(?:\s*[_＿]+)?$/);
    if (!match) continue;

    const option = match[1].trim();
    if (option && option !== "其他") {
      options.push(option);
    }
  }

  return options;
}

function collectCheckboxOptions(text: string, bucket: Set<string>): void {
  for (const option of extractCheckboxOptionsFromText(text)) {
    bucket.add(option);
  }
}

function optionMatchesTarget(option: string, target: string): boolean {
  const normalizedOption = normalizeOptionLabel(option);
  const normalizedTarget = normalizeOptionLabel(target);
  if (!normalizedOption || !normalizedTarget) return false;
  return (
    normalizedOption === normalizedTarget ||
    normalizedOption.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedOption)
  );
}

function isAllowedOptionCheck(option: string, allowedOptions: string[]): boolean {
  return allowedOptions.some((allowed) => optionMatchesTarget(allowed, option));
}

function applyOptionChecksToText(
  text: string,
  optionsToCheck: string[]
): { text: string; count: number; matched: string[] } {
  if (!optionsToCheck.length) {
    return { text, count: 0, matched: [] };
  }

  let count = 0;
  const matched: string[] = [];
  const lines = text.split(/\r/);
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!UNCHECKED_MARKERS.test(trimmed) || CHECKED_MARKERS.test(trimmed)) {
      return line;
    }

    const labelMatch = trimmed.match(/^[□☐▢\u2610]\s*(.+?)(?:\s*[_＿]+)?$/);
    if (!labelMatch) return line;

    const label = labelMatch[1].trim();
    const shouldCheck = optionsToCheck.some((target) => optionMatchesTarget(label, target));
    if (!shouldCheck) return line;

    count += 1;
    matched.push(label);
    return line.replace(UNCHECKED_MARKERS, "☑");
  });

  return { text: newLines.join("\r"), count, matched };
}

function extractInlineValue(text: string): string | null {
  const match = text.match(/[：:]\s*([^\r\n]+)$/);
  if (!match) return null;
  const value = match[1].trim();
  return isPlaceholderText(value) ? "" : value;
}

async function intersectsScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  targetRange: Word.Range
): Promise<boolean> {
  try {
    const intersection = scopeRange.intersectWith(targetRange);
    intersection.load("isEmpty");
    await context.sync();
    return !intersection.isEmpty;
  } catch {
    return false;
  }
}

function snapshotItems<T>(collection: { items: T[] }): T[] {
  return collection.items.slice();
}

async function loadTableStructure(
  context: Word.RequestContext,
  table: Word.Table
): Promise<{ rowTexts: string[][]; rowCellsList: Word.TableCell[][] }> {
  table.rows.load("items");
  await context.sync();
  const rows = snapshotItems(table.rows);

  const rowCellsList: Word.TableCell[][] = [];
  for (const row of rows) {
    row.cells.load("items");
    await context.sync();
    const cells = snapshotItems(row.cells);
    rowCellsList.push(cells);
    for (const cell of cells) {
      cell.body.load("text");
    }
  }
  await context.sync();

  const rowTexts = rowCellsList.map((cells) =>
    cells.map((cell) => cell.body.text?.replace(/\r/g, "").trim() ?? "")
  );

  return { rowTexts, rowCellsList };
}

function detectPersonnelHeader(rowTexts: string[][]): {
  personnelHeaderRow: number;
  columnMap: Record<string, number>;
} {
  let personnelHeaderRow = -1;
  let columnMap: Record<string, number> = {};

  for (let rowIndex = 0; rowIndex < rowTexts.length; rowIndex++) {
    const cellTexts = rowTexts[rowIndex];
    const rowColumnMap: Record<string, number> = {};

    for (let colIndex = 0; colIndex < cellTexts.length; colIndex++) {
      const normalized = normalizeFieldLabel(cellTexts[colIndex]);
      if (PERSONNEL_COLUMNS.includes(normalized) || normalized === "职务" || normalized === "职称") {
        const key = normalized === "职务" || normalized === "职称" ? "职务/职称" : normalized;
        rowColumnMap[key] = colIndex;
      }
    }

    if (Object.keys(rowColumnMap).length > Object.keys(columnMap).length) {
      columnMap = rowColumnMap;
      personnelHeaderRow = rowIndex;
    }
  }

  return { personnelHeaderRow, columnMap };
}

async function fillPersonnelInTable(
  context: Word.RequestContext,
  table: Word.Table,
  personnel: Array<Record<string, string>>,
  details: string[]
): Promise<number> {
  let { rowTexts, rowCellsList } = await loadTableStructure(context, table);
  const { personnelHeaderRow, columnMap } = detectPersonnelHeader(rowTexts);
  if (personnelHeaderRow < 0 || Object.keys(columnMap).length < 2) {
    return 0;
  }

  await ensurePersonnelDataRows(context, table, personnelHeaderRow, personnel.length);
  ({ rowTexts, rowCellsList } = await loadTableStructure(context, table));

  let filledCount = 0;
  for (let i = 0; i < personnel.length; i++) {
    const rowIndex = personnelHeaderRow + 1 + i;
    if (rowIndex >= rowCellsList.length) break;

    const cells = rowCellsList[rowIndex];
    const person = personnel[i];
    const rowDetails: string[] = [];
    let rowFilled = 0;

    for (const [colLabel, colIndex] of Object.entries(columnMap) as Array<[string, number]>) {
      const value =
        person[colLabel] || person[colLabel.replace("/", "")] || person[colLabel.split("/")[0]];
      if (!value) continue;

      const cell = cells[colIndex];
      if (!cell) continue;

      cell.body.clear();
      cell.body.insertText(value, Word.InsertLocation.start);
      rowFilled += 1;
      rowDetails.push(`研发人员 ${i + 1} ${colLabel} → ${value}`);
    }

    if (rowFilled > 0) {
      try {
        await context.sync();
        filledCount += rowFilled;
        details.push(...rowDetails);
      } catch {
        // 单行失败时跳过
      }
    }
  }

  return filledCount;
}

async function safeWriteCellValue(
  context: Word.RequestContext,
  cell: Word.TableCell,
  value: string
): Promise<boolean> {
  try {
    cell.body.clear();
    cell.body.insertText(value, Word.InsertLocation.start);
    await context.sync();
    return true;
  } catch {
    try {
      const range = cell.body.getRange();
      range.insertText(value, Word.InsertLocation.replace);
      await context.sync();
      return true;
    } catch {
      return false;
    }
  }
}

async function insertTableRowAfter(
  context: Word.RequestContext,
  table: Word.Table,
  anchorRow: Word.TableRow
): Promise<boolean> {
  try {
    anchorRow.insertRows(Word.InsertLocation.after, 1);
    await context.sync();
    return true;
  } catch {
    try {
      table.addRows(Word.InsertLocation.end, 1);
      await context.sync();
      return true;
    } catch {
      return false;
    }
  }
}

async function ensurePersonnelDataRows(
  context: Word.RequestContext,
  table: Word.Table,
  personnelHeaderRow: number,
  rowsNeeded: number
): Promise<void> {
  table.rows.load("items");
  await context.sync();

  const rowItems = snapshotItems(table.rows);
  let dataRowCount = Math.max(0, rowItems.length - personnelHeaderRow - 1);
  while (dataRowCount < rowsNeeded) {
    const anchorRow = rowItems[rowItems.length - 1];
    const inserted = await insertTableRowAfter(context, table, anchorRow);
    if (!inserted) break;

    table.rows.load("items");
    await context.sync();
    const refreshedRows = snapshotItems(table.rows);
    rowItems.length = 0;
    rowItems.push(...refreshedRows);
    dataRowCount = Math.max(0, rowItems.length - personnelHeaderRow - 1);
  }
}

function formatWordError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ItemNotFound")) {
    return "文档选区已变化或表格结构无法识别，请重新选中表格后点击「填充到文档」";
  }
  if (message.includes("items") && message.includes("load")) {
    return "读取表格结构失败，请重新选中表格区域后重试";
  }
  return message || "填充文档失败";
}

async function cellInScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  cell: Word.TableCell
): Promise<boolean> {
  const cellRange = cell.body.getRange();
  return intersectsScope(context, scopeRange, cellRange);
}

async function paragraphInScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  paragraph: Word.Paragraph
): Promise<boolean> {
  const paragraphRange = paragraph.getRange();
  return intersectsScope(context, scopeRange, paragraphRange);
}

function normalizeFormFillPayload(parsed: Record<string, unknown>): FormFillData | null {
  const fields =
    parsed.fields && typeof parsed.fields === "object"
      ? (parsed.fields as Record<string, string>)
      : {};
  const checkboxes =
    parsed.checkboxes && typeof parsed.checkboxes === "object"
      ? (parsed.checkboxes as Record<string, string>)
      : {};
  const optionChecks = Array.isArray(parsed.optionChecks)
    ? parsed.optionChecks.filter((item): item is string => typeof item === "string")
    : [];
  const personnel = Array.isArray(parsed.personnel)
    ? parsed.personnel.filter((item) => item && typeof item === "object") as Array<Record<string, string>>
    : [];

  const hasContent =
    Object.keys(fields).length > 0 ||
    Object.keys(checkboxes).length > 0 ||
    optionChecks.length > 0 ||
    personnel.length > 0;

  if (!hasContent) return null;

  return { fields, checkboxes, optionChecks, personnel };
}

export function parseFormFillJson(content: string): FormFillData | null {
  const trimmed = content.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [codeBlock?.[1]?.trim(), trimmed].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        const normalized = normalizeFormFillPayload(parsed as Record<string, unknown>);
        if (normalized) return normalized;
      }
    } catch {
      // continue
    }
  }

  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      if (parsed && typeof parsed === "object") {
        return normalizeFormFillPayload(parsed as Record<string, unknown>);
      }
    } catch {
      return null;
    }
  }

  return null;
}

const PERSONNEL_LABEL_PATTERN =
  /^(姓名|单位|职务\/职称|职务|职称|学历|专业方向|联系电话)\s*[：:]\s*(.+)$/;

function resolvePersonnelFieldKey(label: string): string {
  if (label === "职务" || label === "职称") return "职务/职称";
  return label;
}

function parsePersonnelBlock(block: string): Record<string, string> | null {
  const person: Record<string, string> = {};
  const lines = block
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const labeled = line.match(PERSONNEL_LABEL_PATTERN);
    if (labeled) {
      const key = resolvePersonnelFieldKey(labeled[1]);
      person[key] = labeled[2].trim();
    }
  }

  if (Object.keys(person).length >= 2) {
    return person;
  }

  const pipeParts = block
    .split(/\n/)[0]
    ?.split(/[|｜]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (pipeParts && pipeParts.length >= 4) {
    PERSONNEL_COLUMNS.forEach((col, index) => {
      if (pipeParts[index]) person[col] = pipeParts[index];
    });
    if (person["姓名"]) return person;
  }

  const plainLines = lines
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line && !PERSONNEL_COLUMNS.includes(normalizeFieldLabel(line)));

  if (plainLines.length >= 4) {
    PERSONNEL_COLUMNS.forEach((col, index) => {
      if (plainLines[index]) person[col] = plainLines[index];
    });
    if (person["姓名"]) return person;
  }

  return null;
}

export function parseFormFillFromProse(content: string): FormFillData | null {
  const text = content.replace(/\r/g, "\n").trim();
  if (!text || text.startsWith("{")) return null;

  const personnel: Array<Record<string, string>> = [];
  const blocks = text.split(/\n(?=\d+\.\s*)/).filter((block) => block.trim());

  if (blocks.length > 1 || /^\d+\.\s*/.test(text)) {
    for (const block of blocks) {
      const person = parsePersonnelBlock(block);
      if (person) personnel.push(person);
    }
  } else {
    const person = parsePersonnelBlock(text);
    if (person) personnel.push(person);
  }

  if (personnel.length > 0) {
    return { fields: {}, personnel };
  }

  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(.+?)[：:]\s*(.+)$/);
    if (!match) continue;
    const key = resolveFieldKey(match[1]);
    if (isKnownFieldLabel(key)) {
      fields[key] = match[2].trim();
    }
  }

  if (Object.keys(fields).length > 0) {
    return { fields };
  }

  return null;
}

export function resolveFormFillData(content: string): FormFillData | null {
  return parseFormFillJson(content) || parseFormFillFromProse(content);
}

export function shouldTreatAsFormFill(
  message: Pick<UIMessage, "formFill" | "actionId" | "sourceText" | "content">
): boolean {
  if (message.formFill) return true;
  if (isCodeActionId(message.actionId)) return false;
  if (message.sourceText?.trim() && detectSelectionContentKind(message.sourceText) === "code") {
    return false;
  }
  return !!resolveFormFillData(message.content);
}

export function filterFormFillData(data: FormFillData, scan: FormScanResult): FormFillData {
  const allowedFields = new Set(scan.fieldLabels);
  const filteredFields: Record<string, string> = {};

  for (const [key, value] of Object.entries(data.fields || {})) {
    if (allowedFields.has(key)) {
      filteredFields[key] = value;
    }
  }

  const filteredCheckboxes: Record<string, string> = {};
  if (scan.hasCheckboxGroups && data.checkboxes) {
    for (const [key, value] of Object.entries(data.checkboxes)) {
      if (key === "技术水平" && value) {
        filteredCheckboxes[key] = value;
      }
    }
  }

  const filteredOptionChecks = scan.hasOptionChecks
    ? (data.optionChecks || []).filter((option) => isAllowedOptionCheck(option, scan.checkboxOptions))
    : [];

  const filteredPersonnel = scan.hasPersonnelTable
    ? (data.personnel || [])
        .map((person) => {
          const row: Record<string, string> = {};
          for (const col of PERSONNEL_COLUMNS) {
            const value = person[col] || person[col.replace("/", "")] || person[col.split("/")[0]];
            if (value) row[col] = value;
          }
          return row;
        })
        .filter((person) => Object.keys(person).length > 0)
    : data.personnel && !scan.hasPersonnelTable
      ? []
      : (data.personnel || []);

  return {
    fields: filteredFields,
    checkboxes: filteredCheckboxes,
    optionChecks: filteredOptionChecks,
    personnel: filteredPersonnel,
  };
}

export function formatFormFillPreview(data: FormFillData): string {
  const lines: string[] = ["【选中区域填充预览】"];

  const fieldEntries = Object.entries(data.fields || {});
  if (fieldEntries.length > 0) {
    lines.push("", "■ 基本信息");
    for (const [key, value] of fieldEntries) {
      lines.push(`${key}：${value}`);
    }
  }

  const checkboxEntries = Object.entries(data.checkboxes || {});
  if (checkboxEntries.length > 0) {
    lines.push("", "■ 单选项");
    for (const [key, value] of checkboxEntries) {
      lines.push(`${key}：${value}`);
    }
  }

  if (data.optionChecks && data.optionChecks.length > 0) {
    lines.push("", `■ 方框勾选（${data.optionChecks.length} 项）`);
    for (const option of data.optionChecks) {
      lines.push(`☑ ${option}`);
    }
  }

  if (data.personnel && data.personnel.length > 0) {
    lines.push("", `■ 研发人员（${data.personnel.length} 人）`);
    data.personnel.forEach((person, index) => {
      const parts = PERSONNEL_COLUMNS.map((col) => {
        const val = person[col] || person[col.replace("/", "")] || person[col.split("/")[0]] || "";
        return val ? `${col}：${val}` : "";
      }).filter(Boolean);
      lines.push(`${index + 1}. ${parts.join("；")}`);
    });
  }

  lines.push("", "确认无误后点击「填充到文档」，内容仅写入当前选中区域。");
  return lines.join("\n");
}

async function scanTablesInScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  labels: Set<string>,
  checkboxOptions: Set<string>,
  state: { hasPersonnelTable: boolean; hasCheckboxGroups: boolean; hasOptionChecks: boolean }
): Promise<void> {
  const tables = scopeRange.tables;
  tables.load("items");
  await context.sync();

  const tableList = snapshotItems(tables);

  for (const table of tableList) {
    let personnelHeaderRow = -1;
    let columnMap: Record<string, number> = {};
    let hasScopedPersonnelRow = false;
    let hasScopedCheckboxRow = false;

    const { rowTexts } = await loadTableStructure(context, table);
    const headerInfo = detectPersonnelHeader(rowTexts);
    personnelHeaderRow = headerInfo.personnelHeaderRow;
    columnMap = headerInfo.columnMap;

    for (let rowIndex = 0; rowIndex < rowTexts.length; rowIndex++) {
      const cellTexts = rowTexts[rowIndex];

      for (let colIndex = 0; colIndex < cellTexts.length; colIndex++) {
        const text = cellTexts[colIndex];
        collectCheckboxOptions(text, checkboxOptions);
        const label = extractLabelFromCellText(text);
        if (label && label !== "技术水平") {
          labels.add(label);
        }
      }

      if (cellTexts.some((text) => normalizeFieldLabel(text) === "技术水平")) {
        hasScopedCheckboxRow = true;
        labels.add("技术水平");
      }

      if (cellTexts.length >= 2) {
        const leftLabel = extractLabelFromCellText(cellTexts[0]);
        if (leftLabel && isPlaceholderText(cellTexts[1])) {
          labels.add(leftLabel);
        }
      }
    }

    if (personnelHeaderRow >= 0 && Object.keys(columnMap).length >= 3) {
      for (let rowIndex = personnelHeaderRow + 1; rowIndex < rowTexts.length; rowIndex++) {
        const cellTexts = rowTexts[rowIndex];
        if (cellTexts.some((text) => isPlaceholderText(text)) || cellTexts.every((text) => !text)) {
          hasScopedPersonnelRow = true;
          break;
        }
      }
    }

    if (hasScopedPersonnelRow) {
      state.hasPersonnelTable = true;
      for (const col of PERSONNEL_COLUMNS) {
        labels.add(col);
      }
    }

    if (hasScopedCheckboxRow) {
      state.hasCheckboxGroups = true;
    }

    if (checkboxOptions.size > 0) {
      state.hasOptionChecks = true;
    }
  }
}

async function scanParagraphsInScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  labels: Set<string>,
  checkboxOptions: Set<string>
): Promise<void> {
  const paragraphs = scopeRange.paragraphs;
  paragraphs.load("items");
  await context.sync();

  const paragraphItems = snapshotItems(paragraphs);

  for (const paragraph of paragraphItems) {
    paragraph.load("text");
  }
  await context.sync();

  const scopedParagraphs: Array<{ index: number; text: string }> = [];
  for (let i = 0; i < paragraphItems.length; i++) {
    const paragraph = paragraphItems[i];
    scopedParagraphs.push({
      index: i,
      text: paragraph.text?.replace(/\r/g, "").trim() ?? "",
    });
  }

  for (let i = 0; i < scopedParagraphs.length; i++) {
    const { text } = scopedParagraphs[i];
    collectCheckboxOptions(text, checkboxOptions);
    const label = extractLabelFromCellText(text);
    if (!label || label === "技术水平") continue;

    const inlineValue = extractInlineValue(text);
    if (inlineValue !== null) {
      labels.add(label);
      continue;
    }

    if (/[：:]\s*$/.test(text) || /[：:]\s*[_＿]+$/.test(text)) {
      labels.add(label);
      continue;
    }

    if (i > 0) {
      const prevText = scopedParagraphs[i - 1].text;
      const prevLabel = extractLabelFromCellText(prevText);
      if (prevLabel && isPlaceholderText(text)) {
        labels.add(prevLabel);
      }
    }
  }
}

export async function scanFormFields(): Promise<FormScanResult> {
  try {
    return await Word.run(async (context) => {
      const scopeRange = context.document.getSelection();
      scopeRange.load("text,isEmpty");
      await context.sync();

      if (scopeRange.isEmpty || !scopeRange.text?.trim()) {
        throw new Error("请先在文档中选中需要填写的表单区域");
      }

      const labels = new Set<string>();
      const checkboxOptions = new Set<string>();
      const state = { hasPersonnelTable: false, hasCheckboxGroups: false, hasOptionChecks: false };

      await scanTablesInScope(context, scopeRange, labels, checkboxOptions, state);
      await scanParagraphsInScope(context, scopeRange, labels, checkboxOptions);

      if (checkboxOptions.size > 0) {
        state.hasOptionChecks = true;
      }

      const selectionPreview = scopeRange.text?.trim() ?? "";

      return {
        fieldLabels: Array.from(labels),
        checkboxOptions: Array.from(checkboxOptions),
        hasPersonnelTable: state.hasPersonnelTable,
        hasCheckboxGroups: state.hasCheckboxGroups,
        hasOptionChecks: state.hasOptionChecks,
        documentPreview: selectionPreview.slice(0, 4000),
        selectionPreview,
      };
    });
  } catch (err) {
    throw new Error(formatWordError(err));
  }
}

async function fillTablesInScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  data: FormFillData,
  details: string[]
): Promise<number> {
  let filledCount = 0;

  let tableItems: Word.Table[] = [];
  try {
    const tables = scopeRange.tables;
    tables.load("items");
    await context.sync();
    tableItems = snapshotItems(tables);
  } catch {
    return 0;
  }

  for (const table of tableItems) {
    try {
      filledCount += await fillSingleTableInScope(context, scopeRange, table, data, details);
    } catch {
      // 单表失败时跳过，避免整次填充因 ItemNotFound 中断
    }
  }

  return filledCount;
}

async function fillSingleTableInScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  table: Word.Table,
  data: FormFillData,
  details: string[]
): Promise<number> {
  let filledCount = 0;

  if (data.personnel && data.personnel.length > 0) {
    filledCount += await fillPersonnelInTable(context, table, data.personnel, details);
  }

  const { rowTexts, rowCellsList } = await loadTableStructure(context, table);

  for (let rowIndex = 0; rowIndex < rowCellsList.length; rowIndex++) {
    const cells = rowCellsList[rowIndex];
    const cellTexts = rowTexts[rowIndex];

    if (cellTexts.some((text) => normalizeFieldLabel(text) === "技术水平")) {
      const selected = data.checkboxes?.技术水平;
      if (selected) {
        for (let colIndex = 0; colIndex < cells.length; colIndex++) {
          const optionText = cellTexts[colIndex];
          const option = TECH_LEVEL_OPTIONS.find((item) => optionText.includes(item));
          if (!option) continue;

          const cell = cells[colIndex];
          if (option === selected) {
            if (!optionText.includes("☑") && !optionText.includes("√")) {
              cell.body.clear();
              cell.body.insertText(`☑ ${option}`, Word.InsertLocation.start);
              filledCount += 1;
              details.push(`技术水平 → ${option}`);
            }
          } else if (optionText.includes("☑") || optionText.includes("√")) {
            cell.body.clear();
            cell.body.insertText(option, Word.InsertLocation.start);
          }
        }
      }
    }

    if (cells.length >= 2) {
      const label = extractLabelFromCellText(cellTexts[0]);
      const value = label ? data.fields[label] : undefined;
      if (label && value && isPlaceholderText(cellTexts[1])) {
        cells[1].body.clear();
        cells[1].body.insertText(value, Word.InsertLocation.start);
        filledCount += 1;
        details.push(`${label} → ${value}`);
      }
    }

    for (let colIndex = 0; colIndex < cellTexts.length; colIndex++) {
      const text = cellTexts[colIndex];
      const label = extractLabelFromCellText(text);
      const value = label ? data.fields[label] : undefined;
      if (!label || !value) continue;

      const inlineValue = extractInlineValue(text);
      if (inlineValue !== null && inlineValue !== value) {
        const newText = text.replace(/[：:]\s*[^\r\n]+$/, `：${value}`);
        cells[colIndex].body.clear();
        cells[colIndex].body.insertText(newText, Word.InsertLocation.start);
        filledCount += 1;
        details.push(`${label} → ${value}`);
      }
    }

    if (data.optionChecks && data.optionChecks.length > 0) {
      for (let colIndex = 0; colIndex < cells.length; colIndex++) {
        const currentText = cellTexts[colIndex];
        const result = applyOptionChecksToText(currentText, data.optionChecks);
        if (result.count > 0) {
          cells[colIndex].body.clear();
          cells[colIndex].body.insertText(result.text, Word.InsertLocation.start);
          filledCount += result.count;
          result.matched.forEach((option) => details.push(`勾选 → ${option}`));
        }
      }
    }
  }

  try {
    await context.sync();
  } catch {
    // 忽略 sync 失败
  }

  return filledCount;
}

async function fillParagraphsInScope(
  context: Word.RequestContext,
  scopeRange: Word.Range,
  data: FormFillData,
  details: string[]
): Promise<number> {
  const paragraphs = scopeRange.paragraphs;
  paragraphs.load("items");
  await context.sync();

  const paragraphItems = snapshotItems(paragraphs);

  for (const paragraph of paragraphItems) {
    paragraph.load("text");
  }
  await context.sync();

  let filledCount = 0;
  const filledLabels = new Set<string>();

  const scopedParagraphs: Array<{ paragraph: Word.Paragraph; text: string }> = [];
  for (const paragraph of paragraphItems) {
    if (!(await paragraphInScope(context, scopeRange, paragraph))) continue;
    scopedParagraphs.push({
      paragraph,
      text: paragraph.text?.replace(/\r/g, "").trim() ?? "",
    });
  }

  for (let i = 0; i < scopedParagraphs.length; i++) {
    const { paragraph, text } = scopedParagraphs[i];

    if (data.optionChecks && data.optionChecks.length > 0) {
      const result = applyOptionChecksToText(text, data.optionChecks);
      if (result.count > 0) {
        paragraph.insertText(result.text, Word.InsertLocation.replace);
        filledCount += result.count;
        result.matched.forEach((option) => details.push(`勾选 → ${option}`));
        continue;
      }
    }

    const label = extractLabelFromCellText(text);
    if (!label) continue;

    const value = data.fields[label];
    if (!value || filledLabels.has(label)) continue;

    const inlineValue = extractInlineValue(text);
    if (inlineValue !== null) {
      const newText = text.replace(/[：:]\s*[^\r\n]+$/, `：${value}`);
      paragraph.insertText(newText, Word.InsertLocation.replace);
      filledCount += 1;
      filledLabels.add(label);
      details.push(`${label} → ${value}`);
      continue;
    }

    if (/[：:]\s*$/.test(text) || /[：:]\s*[_＿]+$/.test(text)) {
      if (i + 1 < scopedParagraphs.length) {
        const nextParagraph = scopedParagraphs[i + 1].paragraph;
        nextParagraph.load("text");
        await context.sync();
        const nextText = nextParagraph.text?.replace(/\r/g, "").trim() ?? "";
        if (isPlaceholderText(nextText)) {
          nextParagraph.insertText(value, Word.InsertLocation.replace);
          filledCount += 1;
          filledLabels.add(label);
          details.push(`${label} → ${value}`);
          continue;
        }
      }

      const newText = text.replace(/[：:]\s*[_＿]*$/, `：${value}`);
      paragraph.insertText(newText, Word.InsertLocation.replace);
      filledCount += 1;
      filledLabels.add(label);
      details.push(`${label} → ${value}`);
      continue;
    }

    if (i > 0) {
      const prevText = scopedParagraphs[i - 1].text;
      const prevLabel = extractLabelFromCellText(prevText);
      if (prevLabel === label && isPlaceholderText(text)) {
        paragraph.insertText(value, Word.InsertLocation.replace);
        filledCount += 1;
        filledLabels.add(label);
        details.push(`${label} → ${value}`);
      }
    }
  }

  await context.sync();
  return filledCount;
}

export async function fillFormFields(data: FormFillData): Promise<FormFillResult> {
  if (!data.fields || Object.keys(data.fields).length === 0) {
    const hasPersonnel = data.personnel && data.personnel.length > 0;
    const hasCheckbox = data.checkboxes && Object.keys(data.checkboxes).length > 0;
    const hasOptionChecks = data.optionChecks && data.optionChecks.length > 0;
    if (!hasPersonnel && !hasCheckbox && !hasOptionChecks) {
      return { success: false, filledCount: 0, error: "没有可填充的字段数据" };
    }
  }

  try {
    return await Word.run(async (context) => {
      const scopeRange = context.document.getSelection();
      scopeRange.load("text,isEmpty");
      await context.sync();

      if (scopeRange.isEmpty || !scopeRange.text?.trim()) {
        return {
          success: false,
          filledCount: 0,
          error: "请先在文档中选中需要填写的表单区域",
        };
      }

      const details: string[] = [];
      const tableFilled = await fillTablesInScope(context, scopeRange, data, details);
      const paragraphFilled = await fillParagraphsInScope(context, scopeRange, data, details);
      const filledCount = tableFilled + paragraphFilled;

      if (filledCount === 0) {
        return {
          success: false,
          filledCount: 0,
          error: "未能在选中区域内匹配到可填充字段，请扩大选中范围后重试",
          details,
        };
      }

      if (formFillScopeRange) {
        context.trackedObjects.remove(formFillScopeRange);
        formFillScopeRange = null;
      }

      return { success: true, filledCount, details };
    });
  } catch (err) {
    return {
      success: false,
      filledCount: 0,
      error: formatWordError(err),
    };
  }
}

export async function applyFormFillContent(content: string): Promise<FormFillResult> {
  const resolved = resolveFormFillData(content);
  if (!resolved) {
    return {
      success: false,
      filledCount: 0,
      error: "无法识别填充内容，请重新生成后点击「填充到文档」",
    };
  }

  return fillFormFields(resolved);
}
