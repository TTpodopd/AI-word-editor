/* global Word */

import { convertLatexToOoxml } from "./latexService";
import { localizeErrorMessage } from "../utils/localizeErrorMessage";
import {
  isWritingStructuralHeading,
  mergeWritingSectionTexts,
  normalizeWritingSectionText,
  shouldCenterWritingParagraph,
  shouldIndentWritingParagraph,
  shouldRightAlignWritingParagraph,
  WRITING_BODY_FONT_SIZE,
  WRITING_FONT_NAME,
  WRITING_LINE_SPACING,
  WRITING_TITLE_FONT_SIZE,
} from "../utils/textFormat";
import type { DocumentHeading } from "../types";

let trackedRange: Word.Range | null = null;
let trackedCursor: Word.Range | null = null;
export type ApplyMode = "replace" | "insert";

export interface ApplyTextOptions {
  firstLineIndentChars?: number;
}

let currentApplyMode: ApplyMode = "replace";

export async function readCurrentSelection(): Promise<{ text: string; charCount: number; hasSelection: boolean }> {
  return Word.run(async (context) => {
    const range = context.document.getSelection();
    range.load("text,isEmpty");
    await context.sync();

    const text = range.text?.trim() ?? "";
    return {
      text,
      charCount: text.length,
      hasSelection: !range.isEmpty && text.length > 0,
    };
  });
}

function clearTrackedObjects(context: Word.RequestContext) {
  if (trackedRange) {
    context.trackedObjects.remove(trackedRange);
    trackedRange = null;
  }
  if (trackedCursor) {
    context.trackedObjects.remove(trackedCursor);
    trackedCursor = null;
  }
}

export async function captureSelection(): Promise<{ text: string; success: boolean }> {
  return Word.run(async (context) => {
    const range = context.document.getSelection();
    range.load("text,isEmpty");
    await context.sync();

    if (range.isEmpty || !range.text?.trim()) {
      return { text: "", success: false };
    }

    clearTrackedObjects(context);

    range.track();
    context.trackedObjects.add(range);
    trackedRange = range;
    currentApplyMode = "replace";

    return { text: range.text.trim(), success: true };
  });
}

export async function captureCursor(): Promise<void> {
  await Word.run(async (context) => {
    const range = context.document.getSelection();
    clearTrackedObjects(context);

    range.track();
    context.trackedObjects.add(range);
    trackedCursor = range;
    currentApplyMode = "insert";
  });
}

export function getApplyMode(): ApplyMode {
  return currentApplyMode;
}

const MIN_PARAGRAPH_CHARS_FOR_INDENT = 20;

async function applyFirstLineIndent(
  context: Word.RequestContext,
  insertedRange: Word.Range,
  indentChars: number
): Promise<void> {
  const paragraphs = insertedRange.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const paragraph of paragraphs.items) {
    paragraph.load("text");
    paragraph.font.load("size");
  }
  await context.sync();

  for (const paragraph of paragraphs.items) {
    const paragraphText = paragraph.text?.replace(/\r/g, "").trim() ?? "";
    if (!paragraphText || paragraphText.length < MIN_PARAGRAPH_CHARS_FOR_INDENT) continue;

    const fontSize = paragraph.font.size || 12;
    paragraph.firstLineIndent = fontSize * indentChars;
  }

  await context.sync();
}

export type WritingInsertFormatMode = "standard" | "official-document";

export interface WritingSectionInsert {
  title: string;
  body: string;
  level: 1 | 2 | 3;
}

export interface InsertWritingDocumentOptions extends ApplyTextOptions {
  formatMode?: WritingInsertFormatMode;
}

type ParagraphWithLineSpacing = Word.Paragraph & {
  space1Pt5?: () => void;
  lineSpacing?: number;
};

function applyWritingLineSpacingToParagraph(paragraph: Word.Paragraph): boolean {
  const target = paragraph as ParagraphWithLineSpacing;
  if (typeof target.space1Pt5 === "function") {
    target.space1Pt5();
    return true;
  }
  if ("lineSpacing" in target) {
    target.lineSpacing = WRITING_BODY_FONT_SIZE * 1.5;
    return true;
  }
  return false;
}

function patchParagraphLineSpacingOoxml(
  ooxml: string,
  line: number,
  rule: "auto" | "exact"
): string {
  if (/<w:spacing\b/.test(ooxml)) {
    let patched = ooxml;
    if (/w:line=["']/.test(patched)) {
      patched = patched.replace(/w:line=["'][^"']*["']/g, `w:line="${line}"`);
    } else {
      patched = patched.replace(/<w:spacing\b/, `<w:spacing w:line="${line}"`);
    }
    if (/w:lineRule=["']/.test(patched)) {
      patched = patched.replace(/w:lineRule=["'][^"']*["']/g, `w:lineRule="${rule}"`);
    } else {
      patched = patched.replace(/<w:spacing\b/, `<w:spacing w:lineRule="${rule}"`);
    }
    return patched;
  }

  const spacing = `<w:spacing w:line="${line}" w:lineRule="${rule}"/>`;
  if (/<w:pPr\b/.test(ooxml)) {
    return ooxml.replace(/<w:pPr\b([^>]*)>/, `<w:pPr$1>${spacing}`);
  }
  return ooxml.replace(/<w:p\b([^>]*)>/, `<w:p$1><w:pPr>${spacing}</w:pPr>`);
}

async function applyWritingLineSpacingViaOoxml(
  context: Word.RequestContext,
  paragraphs: Word.ParagraphCollection
): Promise<void> {
  for (let index = 0; index < paragraphs.items.length; index += 1) {
    const paragraph = paragraphs.items[index];
    const text = paragraph.text?.replace(/\r/g, "").trim() ?? "";
    if (!text) continue;

    try {
      const ooxmlResult = paragraph.getOoxml();
      await context.sync();
      const patched = patchParagraphLineSpacingOoxml(
        ooxmlResult.value,
        WRITING_LINE_SPACING.line,
        WRITING_LINE_SPACING.rule
      );
      if (patched === ooxmlResult.value) continue;
      paragraph.insertOoxml(patched, Word.InsertLocation.replace);
      await context.sync();
    } catch {
      // OOXML 替换失败时跳过该段落
    }
  }
}

async function applyWritingParagraphFormat(
  context: Word.RequestContext,
  insertedRange: Word.Range,
  options: {
    formatMode: WritingInsertFormatMode;
    firstLineIndentChars: number;
    titleLineCount?: number;
  }
): Promise<void> {
  const paragraphs = insertedRange.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const paragraph of paragraphs.items) {
    paragraph.load("text,alignment,outlineLevel");
    paragraph.font.load("size,bold,name");
  }
  await context.sync();

  let titleLinesRemaining = options.titleLineCount ?? 0;

  const applyFont = (paragraph: Word.Paragraph, size: number, bold = false) => {
    paragraph.font.name = WRITING_FONT_NAME;
    paragraph.font.size = size;
    paragraph.font.bold = bold;
  };

  for (let index = 0; index < paragraphs.items.length; index += 1) {
    const paragraph = paragraphs.items[index];
    const paragraphText = paragraph.text?.replace(/\r/g, "").trim() ?? "";
    if (!paragraphText) continue;

    paragraph.styleBuiltIn = Word.BuiltInStyleName.normal;
    paragraph.outlineLevel = 10;
    paragraph.firstLineIndent = 0;
    paragraph.leftIndent = 0;

    if (titleLinesRemaining > 0) {
      applyFont(paragraph, WRITING_TITLE_FONT_SIZE, true);
      paragraph.alignment = Word.Alignment.justified;
      titleLinesRemaining -= 1;
    } else if (shouldCenterWritingParagraph(paragraphText, index, options.formatMode)) {
      applyFont(paragraph, WRITING_TITLE_FONT_SIZE, true);
      paragraph.alignment = Word.Alignment.centered;
    } else if (shouldRightAlignWritingParagraph(paragraphText)) {
      applyFont(paragraph, WRITING_BODY_FONT_SIZE, false);
      paragraph.alignment = Word.Alignment.right;
    } else {
      applyFont(paragraph, WRITING_BODY_FONT_SIZE, isWritingStructuralHeading(paragraphText));
      paragraph.alignment = Word.Alignment.justified;

      if (shouldIndentWritingParagraph(paragraphText, options.formatMode)) {
        paragraph.firstLineIndent = WRITING_BODY_FONT_SIZE * options.firstLineIndentChars;
      }
    }

    applyWritingLineSpacingToParagraph(paragraph);
  }

  await context.sync();
  await applyWritingLineSpacingViaOoxml(context, paragraphs);
}

async function insertWritingTextAtRange(
  context: Word.RequestContext,
  targetRange: Word.Range,
  text: string,
  options: InsertWritingDocumentOptions & {
    formatMode: WritingInsertFormatMode;
    titleLineCount?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!text.trim()) {
    return { success: false, error: "章节内容为空" };
  }

  const insertedRange = targetRange.insertText(text, Word.InsertLocation.end);
  const indentChars = options.firstLineIndentChars ?? 0;

  await applyWritingParagraphFormat(context, insertedRange, {
    formatMode: options.formatMode,
    firstLineIndentChars: indentChars,
    titleLineCount: options.titleLineCount,
  });

  return { success: true };
}

export async function insertWritingDocument(
  sections: WritingSectionInsert[],
  options?: InsertWritingDocumentOptions
): Promise<{ success: boolean; error?: string; inserted: number }> {
  const formatMode = options?.formatMode ?? "standard";
  const filledSections = sections.filter((section) => section.body.trim() || section.title.trim());

  if (filledSections.length === 0) {
    return { success: false, error: "没有可插入的章节内容", inserted: 0 };
  }

  let text = "";
  let titleLineCount = 0;

  if (formatMode === "official-document") {
    text = mergeWritingSectionTexts(filledSections.map((section) => section.body));
  } else {
    const chunks: string[] = [];
    for (const section of filledSections) {
      const title = normalizeWritingSectionText(section.title);
      const body = normalizeWritingSectionText(section.body);
      if (title) {
        chunks.push(title);
        titleLineCount += 1;
      }
      if (body) {
        chunks.push(body);
      }
    }
    text = mergeWritingSectionTexts(chunks);
  }

  if (!text.trim()) {
    return { success: false, error: "没有可插入的章节内容", inserted: 0 };
  }

  const runInsert = async (
    context: Word.RequestContext,
    targetRange: Word.Range
  ): Promise<{ success: boolean; error?: string }> =>
    insertWritingTextAtRange(context, targetRange, text, {
      ...options,
      formatMode,
      titleLineCount: formatMode === "standard" ? titleLineCount : 0,
    });

  if (trackedCursor) {
    try {
      return await Word.run(trackedCursor, async (context) => {
        if (trackedCursor!.isNullObject) {
          return { success: false, error: "光标位置已失效，请重新点击文档中的插入位置", inserted: 0 };
        }
        const result = await runInsert(context, trackedCursor!);
        context.trackedObjects.remove(trackedCursor!);
        trackedCursor = null;
        return { ...result, inserted: result.success ? filledSections.length : 0 };
      });
    } catch (err) {
      return { success: false, error: localizeErrorMessage(err, "写入文档失败"), inserted: 0 };
    }
  }

  try {
    return await Word.run(async (context) => {
      const range = context.document.getSelection();
      const result = await runInsert(context, range);
      return { ...result, inserted: result.success ? filledSections.length : 0 };
    });
  } catch (err) {
    return { success: false, error: localizeErrorMessage(err, "写入文档失败"), inserted: 0 };
  }
}

async function insertAndFormat(
  context: Word.RequestContext,
  targetRange: Word.Range,
  text: string,
  insertLocation: Word.InsertLocation,
  options?: ApplyTextOptions
): Promise<{ success: boolean; error?: string }> {
  const insertedRange = targetRange.insertText(text, insertLocation);
  const indentChars = options?.firstLineIndentChars ?? 0;

  if (indentChars > 0 && insertLocation !== Word.InsertLocation.replace) {
    await applyFirstLineIndent(context, insertedRange, indentChars);
  }

  await context.sync();
  return { success: true };
}

export async function applyText(
  text: string,
  options?: ApplyTextOptions
): Promise<{ success: boolean; error?: string }> {
  if (trackedRange) {
    try {
      return await Word.run(trackedRange, async (context) => {
        if (trackedRange!.isNullObject) {
          return { success: false, error: "选区已失效，请重新选中文本后再试" };
        }

        await insertAndFormat(context, trackedRange!, text, Word.InsertLocation.replace, options);
        context.trackedObjects.remove(trackedRange!);
        trackedRange = null;

        return { success: true };
      });
    } catch (err) {
      return { success: false, error: localizeErrorMessage(err, "写入文档失败") };
    }
  }

  if (trackedCursor) {
    try {
      return await Word.run(trackedCursor, async (context) => {
        if (trackedCursor!.isNullObject) {
          return { success: false, error: "光标位置已失效，请重新点击文档中的插入位置" };
        }

        await insertAndFormat(context, trackedCursor!, text, Word.InsertLocation.end, options);
        context.trackedObjects.remove(trackedCursor!);
        trackedCursor = null;

        return { success: true };
      });
    } catch (err) {
      return { success: false, error: localizeErrorMessage(err, "写入文档失败") };
    }
  }

  try {
    return await Word.run(async (context) => {
      const range = context.document.getSelection();
      await insertAndFormat(context, range, text, Word.InsertLocation.end, options);
      return { success: true };
    });
  } catch (err) {
    return { success: false, error: localizeErrorMessage(err, "写入文档失败") };
  }
}

/** @deprecated use applyText */
export async function applyTextToSelection(text: string) {
  return applyText(text);
}

export async function insertOoxmlAtCursor(
  ooxml: string
): Promise<{ success: boolean; error?: string }> {
  if (!ooxml.trim()) {
    return { success: false, error: "公式内容为空" };
  }

  if (trackedRange) {
    try {
      return await Word.run(trackedRange, async (context) => {
        if (trackedRange!.isNullObject) {
          return { success: false, error: "选区已失效，请重新选中文本后再试" };
        }

        trackedRange!.insertOoxml(ooxml, Word.InsertLocation.replace);
        await context.sync();
        context.trackedObjects.remove(trackedRange!);
        trackedRange = null;

        return { success: true };
      });
    } catch (err) {
      return { success: false, error: localizeErrorMessage(err, "插入公式失败") };
    }
  }

  try {
    return await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.insertOoxml(ooxml, Word.InsertLocation.end);
      await context.sync();
      return { success: true };
    });
  } catch (err) {
    return { success: false, error: localizeErrorMessage(err, "插入公式失败") };
  }
}

export async function insertLatexFormula(
  latex: string,
  displayMode = false
): Promise<{ success: boolean; error?: string }> {
  const converted = await convertLatexToOoxml(latex, displayMode);
  if (converted.error || !converted.ooxml) {
    return { success: false, error: converted.error || "公式转换失败" };
  }

  return insertOoxmlAtCursor(converted.ooxml);
}

export function clearTrackedRange(): void {
  trackedRange = null;
  trackedCursor = null;
  currentApplyMode = "replace";
}

export function hasTrackedRange(): boolean {
  return trackedRange !== null || trackedCursor !== null;
}

const HEADING_STYLE_MAP: Record<1 | 2 | 3, Word.BuiltInStyleName> = {
  get 1() {
    return Word.BuiltInStyleName.heading1;
  },
  get 2() {
    return Word.BuiltInStyleName.heading2;
  },
  get 3() {
    return Word.BuiltInStyleName.heading3;
  },
};

function getHeadingStyle(level: 1 | 2 | 3): Word.BuiltInStyleName {
  return HEADING_STYLE_MAP[level];
}

export interface InsertSectionOptions extends ApplyTextOptions {
  addBlankLine?: boolean;
}

export async function insertSectionWithHeading(
  title: string,
  body: string,
  level: 1 | 2 | 3,
  options?: InsertSectionOptions
): Promise<{ success: boolean; error?: string }> {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle && !trimmedBody) {
    return { success: false, error: "章节内容为空" };
  }

  const insertAtRange = async (
    context: Word.RequestContext,
    targetRange: Word.Range
  ): Promise<{ success: boolean; error?: string }> => {
    let cursor = targetRange;

    if (trimmedTitle) {
      const titleInserted = cursor.insertText(`${trimmedTitle}\n`, Word.InsertLocation.end);
      titleInserted.paragraphs.load("items");
      await context.sync();
      if (titleInserted.paragraphs.items.length > 0) {
        titleInserted.paragraphs.items[0].styleBuiltIn = getHeadingStyle(level);
      }
      cursor = titleInserted.getRange(Word.RangeLocation.end);
    }

    if (trimmedBody) {
      const prefix = options?.addBlankLine === false ? "" : trimmedTitle ? "\n" : "";
      const bodyInserted = cursor.insertText(`${prefix}${trimmedBody}\n`, Word.InsertLocation.end);
      const indentChars = options?.firstLineIndentChars ?? 0;
      if (indentChars > 0) {
        await applyFirstLineIndent(context, bodyInserted, indentChars);
      } else {
        await context.sync();
      }
    } else {
      await context.sync();
    }

    return { success: true };
  };

  if (trackedCursor) {
    try {
      return await Word.run(trackedCursor, async (context) => {
        if (trackedCursor!.isNullObject) {
          return { success: false, error: "光标位置已失效，请重新点击文档中的插入位置" };
        }
        const result = await insertAtRange(context, trackedCursor!);
        context.trackedObjects.remove(trackedCursor!);
        trackedCursor = null;
        return result;
      });
    } catch (err) {
      return { success: false, error: localizeErrorMessage(err, "写入章节失败") };
    }
  }

  try {
    return await Word.run(async (context) => {
      const range = context.document.getSelection();
      return insertAtRange(context, range);
    });
  } catch (err) {
    return { success: false, error: localizeErrorMessage(err, "写入章节失败") };
  }
}

export async function readDocumentHeadings(): Promise<{
  headings: DocumentHeading[];
  success: boolean;
  error?: string;
}> {
  try {
    return await Word.run(async (context) => {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items");
      await context.sync();

      for (const paragraph of paragraphs.items) {
        paragraph.load("text,styleBuiltIn");
      }
      await context.sync();

      const headings: DocumentHeading[] = [];
      for (const paragraph of paragraphs.items) {
        const text = paragraph.text?.replace(/\r/g, "").trim() ?? "";
        if (!text) continue;

        let level: 1 | 2 | 3 | null = null;
        if (paragraph.styleBuiltIn === Word.BuiltInStyleName.heading1) level = 1;
        else if (paragraph.styleBuiltIn === Word.BuiltInStyleName.heading2) level = 2;
        else if (paragraph.styleBuiltIn === Word.BuiltInStyleName.heading3) level = 3;

        if (level) {
          headings.push({ title: text, level });
        }
      }

      return { headings, success: true };
    });
  } catch (err) {
    return {
      headings: [],
      success: false,
      error: localizeErrorMessage(err, "读取文档标题失败"),
    };
  }
}

const MAX_ATTACHMENT_CHARS = 120000;

export async function readDocumentTextForAttachment(): Promise<{
  text: string;
  success: boolean;
  sourceName: string;
  error?: string;
}> {
  try {
    const selection = await readCurrentSelection();
    if (selection.hasSelection) {
      return {
        text: selection.text.slice(0, MAX_ATTACHMENT_CHARS),
        success: true,
        sourceName: "Word 选区",
      };
    }

    return await Word.run(async (context) => {
      const body = context.document.body;
      body.load("text");
      await context.sync();

      const text = body.text?.trim() ?? "";
      if (!text) {
        return { text: "", success: false, sourceName: "Word 文档", error: "文档正文为空" };
      }

      return {
        text: text.slice(0, MAX_ATTACHMENT_CHARS),
        success: true,
        sourceName: "Word 文档",
      };
    });
  } catch (err) {
    return {
      text: "",
      success: false,
      sourceName: "Word 文档",
      error: localizeErrorMessage(err, "读取文档失败"),
    };
  }
}
