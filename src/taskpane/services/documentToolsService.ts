/* global Word */

import { localizeErrorMessage } from "../utils/localizeErrorMessage";
import { patchAcademicVariablesInOoxml } from "../utils/academicVariableOoxml";

export interface DocumentToolResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface DocumentToolOptions {
  headerText?: string;
  footerText?: string;
  headerAlign?: "left" | "center" | "right";
  footerAlign?: "left" | "center" | "right";
  tocUpperLevel?: number;
  tocLowerLevel?: number;
  pageNumberAlign?: "left" | "center" | "right";
  pageNumberFormat?: "simple" | "full";
  pageNumberScope?: "all" | "bodyFromCursor";
  pageNumberLayout?: "uniform" | "oddEven";
  pageNumberStart?: number;
  indentChars?: number;
  applyScope?: "document" | "selection";
  outlineLevel?: number | "bodyText";
  lineSpacingPreset?: "single" | "1.5" | "2" | "fixed20" | "fixed22" | "fixed24";
}

function clampOutlineLevel(value: number | undefined): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 {
  const next = Number(value) || 1;
  return Math.min(9, Math.max(1, next)) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

function ok(message: string): DocumentToolResult {
  return { success: true, message };
}

function fail(error: string): DocumentToolResult {
  return { success: false, error };
}

function wrapError(err: unknown, fallback: string): DocumentToolResult {
  return fail(localizeErrorMessage(err, fallback));
}

function clampLevel(value: number | undefined, fallback: number): number {
  const next = Number(value) || fallback;
  return Math.min(9, Math.max(1, next));
}

function toWordAlignment(align: DocumentToolOptions["headerAlign"]): Word.Alignment {
  if (align === "left") return Word.Alignment.left;
  if (align === "right") return Word.Alignment.right;
  return Word.Alignment.centered;
}

async function forEachSection(
  context: Word.RequestContext,
  handler: (section: Word.Section) => void | Promise<void>
): Promise<void> {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();
  for (const section of sections.items) {
    await handler(section);
  }
}

async function clearBodyParagraphs(body: Word.Body): Promise<void> {
  const paragraphs = body.paragraphs;
  paragraphs.load("items");
  await body.context.sync();

  for (let index = paragraphs.items.length - 1; index >= 0; index -= 1) {
    paragraphs.items[index].delete();
  }
  await body.context.sync();
}

async function setSelectionOutlineLevel(level: number | "bodyText"): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load("isEmpty");
      await context.sync();

      if (selection.isEmpty) {
        return fail("请先选中要设置级别的内容");
      }

      const paragraphs = selection.paragraphs;
      paragraphs.load("items");
      await context.sync();

      if (paragraphs.items.length === 0) {
        return fail("选区中没有可设置的段落");
      }

      for (const paragraph of paragraphs.items) {
        paragraph.load("text");
      }
      await context.sync();

      let changed = 0;
      for (const paragraph of paragraphs.items) {
        const text = paragraph.text?.replace(/\r/g, "").trim() ?? "";
        if (!text) continue;

        // Word 段落「大纲级别」：1–9 为各级标题，10 为正文文本（不改样式）
        paragraph.outlineLevel = level === "bodyText" ? 10 : clampOutlineLevel(level);
        changed += 1;
      }

      await context.sync();

      if (changed === 0) {
        return fail("选区中没有非空段落");
      }

      const label = level === "bodyText" ? "正文文本" : `${level} 级`;
      return ok(`已为 ${changed} 个段落设置大纲级别为「${label}」`);
    });
  } catch (err) {
    return wrapError(err, "设置段落大纲级别失败");
  }
}

type PageNumberAlign = "left" | "center" | "right";
type PageNumberFormat = "simple" | "full";
type PageNumberScope = "all" | "bodyFromCursor";
type PageNumberLayout = "uniform" | "oddEven";

interface PageNumberInsertOptions {
  align: PageNumberAlign;
  format: PageNumberFormat;
  scope: PageNumberScope;
  layout: PageNumberLayout;
  startNumber: number;
}

function getFooterTypes(): Word.HeaderFooterType[] {
  return [
    Word.HeaderFooterType.primary,
    Word.HeaderFooterType.evenPages,
    Word.HeaderFooterType.firstPage,
  ];
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const LEGACY_BODY_BOOKMARK = "_AiEditorBodyStart";

function ensurePgNumTypeOnSectPr(sectPr: Element, doc: Document, startNumber: number): void {
  let pgNumType: Element | null = null;
  for (let i = 0; i < sectPr.childNodes.length; i += 1) {
    const node = sectPr.childNodes[i];
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "pgNumType") {
      pgNumType = node as Element;
      break;
    }
  }

  if (!pgNumType) {
    pgNumType = doc.createElementNS(W_NS, "pgNumType");
    sectPr.insertBefore(pgNumType, sectPr.firstChild);
  }

  pgNumType.setAttributeNS(W_NS, "start", String(startNumber));
  pgNumType.setAttributeNS(W_NS, "fmt", "decimal");
}

function patchOoxmlSectionPageStart(ooxmlPackage: string, startNumber: number, sectPrIndex?: number): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ooxmlPackage, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return null;

    const sectPrs = doc.getElementsByTagNameNS(W_NS, "sectPr");
    if (sectPrs.length === 0) return null;

    const index = sectPrIndex ?? sectPrs.length - 1;
    if (index < 0 || index >= sectPrs.length) return null;

    ensurePgNumTypeOnSectPr(sectPrs.item(index)!, doc, startNumber);
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return null;
  }
}

function patchParagraphSectionPageStart(ooxmlPackage: string, startNumber: number): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ooxmlPackage, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return null;

    const paras = doc.getElementsByTagNameNS(W_NS, "p");
    if (paras.length === 0) return null;
    const para = paras.item(0)!;

    let pPr: Element | null = null;
    for (let i = 0; i < para.childNodes.length; i += 1) {
      const node = para.childNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "pPr") {
        pPr = node as Element;
        break;
      }
    }

    if (!pPr) {
      pPr = doc.createElementNS(W_NS, "pPr");
      para.insertBefore(pPr, para.firstChild);
    }

    let sectPr: Element | null = null;
    for (let i = 0; i < pPr.childNodes.length; i += 1) {
      const node = pPr.childNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "sectPr") {
        sectPr = node as Element;
        break;
      }
    }

    if (!sectPr) {
      sectPr = doc.createElementNS(W_NS, "sectPr");
      pPr.appendChild(sectPr);
    }

    ensurePgNumTypeOnSectPr(sectPr, doc, startNumber);
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return null;
  }
}

async function tryPatchParagraphPageStart(paragraph: Word.Paragraph, startNumber: number): Promise<boolean> {
  try {
    const ooxmlResult = paragraph.getOoxml();
    await paragraph.context.sync();
    const patched = patchParagraphSectionPageStart(ooxmlResult.value, startNumber);
    if (!patched) return false;
    paragraph.insertOoxml(patched, Word.InsertLocation.replace);
    await paragraph.context.sync();
    return true;
  } catch {
    return false;
  }
}

async function tryRestartPageNumberInSection(
  context: Word.RequestContext,
  sectionIndex: number,
  startNumber: number
): Promise<boolean> {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();
  if (sectionIndex < 0 || sectionIndex >= sections.items.length) return false;

  const section = sections.items[sectionIndex];

  try {
    const sectionOoxml = section.body.getOoxml();
    await context.sync();
    const sectPrs = new DOMParser()
      .parseFromString(sectionOoxml.value, "application/xml")
      .getElementsByTagNameNS(W_NS, "sectPr");
    const candidateIndexes =
      sectPrs.length <= 1 ? [0] : [0, sectPrs.length - 1];

    for (const sectPrIndex of candidateIndexes) {
      const patched = patchOoxmlSectionPageStart(sectionOoxml.value, startNumber, sectPrIndex);
      if (!patched) continue;
      section.body.insertOoxml(patched, Word.InsertLocation.replace);
      await context.sync();
      return true;
    }
  } catch {
    // fall through to paragraph-level patch
  }

  const sectionParagraphs = section.body.paragraphs;
  sectionParagraphs.load("items");
  await context.sync();
  if (sectionParagraphs.items.length === 0) return false;

  const firstParagraph = sectionParagraphs.items[0];
  if (await tryPatchParagraphPageStart(firstParagraph, startNumber)) {
    return true;
  }

  const lastParagraph = sectionParagraphs.items[sectionParagraphs.items.length - 1];
  if (lastParagraph !== firstParagraph) {
    return tryPatchParagraphPageStart(lastParagraph, startNumber);
  }

  return false;
}

async function getPreviousBodyParagraph(
  context: Word.RequestContext,
  targetRange: Word.Range
): Promise<Word.Paragraph | null> {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  const targetParagraph = targetRange.paragraphs.getFirst();
  const targetParagraphRange = targetParagraph.getRange();

  for (let index = 0; index < paragraphs.items.length; index += 1) {
    const relation = targetParagraphRange.compareLocationWith(paragraphs.items[index].getRange());
    await context.sync();
    if (
      relation.value === Word.LocationRelation.inside ||
      relation.value === Word.LocationRelation.equal
    ) {
      return index > 0 ? paragraphs.items[index - 1] : null;
    }
  }

  return null;
}

async function tryRestartPageNumberAtBodyStart(
  context: Word.RequestContext,
  bodyStartRange: Word.Range,
  bodyStartIndex: number,
  startNumber: number
): Promise<boolean> {
  const previous = await getPreviousBodyParagraph(context, bodyStartRange);
  if (previous && (await tryPatchParagraphPageStart(previous, startNumber))) {
    return true;
  }

  if (await tryPatchParagraphPageStart(bodyStartRange.paragraphs.getFirst(), startNumber)) {
    return true;
  }

  return tryRestartPageNumberInSection(context, bodyStartIndex, startNumber);
}

function toOoxmlJc(align: Word.Alignment): string {
  if (align === Word.Alignment.left) return "left";
  if (align === Word.Alignment.right) return "right";
  return "center";
}

function buildPageFooterOoxml(align: Word.Alignment, format: PageNumberFormat): string {
  const jc = toOoxmlJc(align);
  const pageField = `
          <w:r><w:fldChar w:fldCharType="begin"/></w:r>
          <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="separate"/></w:r>
          <w:r><w:t>1</w:t></w:r>
          <w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const numPagesField = `
          <w:r><w:fldChar w:fldCharType="begin"/></w:r>
          <w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="separate"/></w:r>
          <w:r><w:t>1</w:t></w:r>
          <w:r><w:fldChar w:fldCharType="end"/></w:r>`;

  const body =
    format === "full"
      ? `<w:p>
          <w:pPr><w:jc w:val="${jc}"/></w:pPr>
          <w:r><w:t>第 </w:t></w:r>${pageField}
          <w:r><w:t> 页 / 共 </w:t></w:r>${numPagesField}
          <w:r><w:t> 页</w:t></w:r>
        </w:p>`
      : `<w:p>
          <w:pPr><w:jc w:val="${jc}"/></w:pPr>${pageField}
        </w:p>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
  <pkg:part pkg:name="/word/footer1.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml">
    <pkg:xmlData>
      <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}
      </w:ftr>
    </pkg:xmlData>
  </pkg:part>
</pkg:package>`;
}

async function unlinkSectionFooters(section: Word.Section): Promise<void> {
  for (const type of getFooterTypes()) {
    try {
      const footer = section.getFooter(type);
      footer.insertText("\u200B", Word.InsertLocation.end);
      await footer.context.sync();
      await clearBodyParagraphs(footer);
      await footer.context.sync();
    } catch {
      // Some footer types may be unavailable until enabled.
    }
  }
}

async function removeLegacyBookmarkIfExists(context: Word.RequestContext): Promise<void> {
  const existing = context.document.getBookmarkRangeOrNullObject(LEGACY_BODY_BOOKMARK);
  existing.load("isNullObject");
  await context.sync();
  if (!existing.isNullObject) {
    context.document.deleteBookmark(LEGACY_BODY_BOOKMARK);
  }
}

async function findSectionIndexForRange(
  context: Word.RequestContext,
  targetRange: Word.Range
): Promise<number> {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();

  for (let index = 0; index < sections.items.length; index += 1) {
    const sectionRange = sections.items[index].body.getRange();
    const relation = targetRange.compareLocationWith(sectionRange);
    await context.sync();
    if (relation.value === Word.LocationRelation.inside) {
      return index;
    }
  }

  return Math.max(0, sections.items.length - 1);
}

async function isRangeAtSectionStart(
  context: Word.RequestContext,
  range: Word.Range,
  sectionIndex: number
): Promise<boolean> {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();

  if (sectionIndex < 0 || sectionIndex >= sections.items.length) {
    return false;
  }

  const sectionStart = sections.items[sectionIndex].body.getRange(Word.RangeLocation.start);
  const relation = range.compareLocationWith(sectionStart);
  await context.sync();
  return relation.value === Word.LocationRelation.equal;
}

async function writePageNumberToFooter(
  footer: Word.Body,
  format: PageNumberFormat,
  align: Word.Alignment,
  independentFooter = false
): Promise<void> {
  if (independentFooter) {
    try {
      footer.insertOoxml(buildPageFooterOoxml(align, format), Word.InsertLocation.replace);
      await footer.context.sync();
      return;
    } catch {
      // fall through to field-based footer
    }
  }

  await clearBodyParagraphs(footer);
  const paragraph = footer.insertParagraph("", Word.InsertLocation.start);
  paragraph.alignment = align;

  const insertPageField = (target: Word.Range) => {
    target.insertField(Word.InsertLocation.end, Word.FieldType.page);
  };

  if (format === "simple") {
    insertPageField(paragraph.getRange(Word.RangeLocation.end));
    return;
  }

  paragraph.insertText("第 ", Word.InsertLocation.end);
  insertPageField(paragraph.getRange(Word.RangeLocation.end));
  paragraph.insertText(" 页 / 共 ", Word.InsertLocation.end);
  paragraph.getRange(Word.RangeLocation.end).insertField(Word.InsertLocation.end, Word.FieldType.numPages);
  paragraph.insertText(" 页", Word.InsertLocation.end);
}

async function updateSectionFooterFields(section: Word.Section): Promise<void> {
  for (const type of getFooterTypes()) {
    try {
      const footer = section.getFooter(type);
      const fields = footer.fields;
      fields.load("items");
      await footer.context.sync();
      for (const field of fields.items) {
        field.updateResult();
      }
      await footer.context.sync();
    } catch {
      // Some footer types may be unavailable until enabled.
    }
  }
}

async function clearSectionFooters(section: Word.Section): Promise<void> {
  for (const type of getFooterTypes()) {
    try {
      const footer = section.getFooter(type);
      await clearBodyParagraphs(footer);
    } catch {
      // Some footer types may be unavailable until enabled.
    }
  }
}

async function setSectionOddEven(section: Word.Section, enabled: boolean): Promise<void> {
  try {
    section.pageSetup.oddAndEvenPagesHeaderFooter = enabled;
  } catch {
    // PageSetup is unavailable on some hosts.
  }
}

async function applyPageNumbersToSection(
  section: Word.Section,
  options: PageNumberInsertOptions,
  independentFooter = false
): Promise<void> {
  if (options.layout === "oddEven") {
    await setSectionOddEven(section, true);
    const oddFooter = section.getFooter(Word.HeaderFooterType.primary);
    const evenFooter = section.getFooter(Word.HeaderFooterType.evenPages);
    await writePageNumberToFooter(oddFooter, options.format, Word.Alignment.right, independentFooter);
    await writePageNumberToFooter(evenFooter, options.format, Word.Alignment.left, independentFooter);
    return;
  }

  await setSectionOddEven(section, false);
  const footer = section.getFooter(Word.HeaderFooterType.primary);
  await writePageNumberToFooter(
    footer,
    options.format,
    toWordAlignment(options.align),
    independentFooter
  );
}

async function insertPageNumbers(options: PageNumberInsertOptions): Promise<DocumentToolResult> {
  const startNumber = Math.min(999, Math.max(1, options.startNumber || 1));

  try {
    return await Word.run(async (context) => {
      let bodyStartIndex = 0;
      let pageRestartApplied = false;

      if (options.scope === "bodyFromCursor") {
        await removeLegacyBookmarkIfExists(context);

        const bodyStartRange = context.document.getSelection().getRange();
        bodyStartRange.track();

        let sectionIndex = await findSectionIndexForRange(context, bodyStartRange);
        const atSectionStart = await isRangeAtSectionStart(context, bodyStartRange, sectionIndex);

        // 与 Word 手动流程一致：在正文起始处插入「下一页」分节符
        if (!(sectionIndex > 0 && atSectionStart)) {
          bodyStartRange.insertBreak(Word.BreakType.sectionNext, Word.InsertLocation.before);
          await context.sync();
          sectionIndex = await findSectionIndexForRange(context, bodyStartRange);
        }

        bodyStartIndex = sectionIndex;
        pageRestartApplied = await tryRestartPageNumberAtBodyStart(
          context,
          bodyStartRange,
          bodyStartIndex,
          startNumber
        );
      }

      const sections = context.document.sections;
      sections.load("items");
      await context.sync();

      if (options.scope === "bodyFromCursor") {
        for (let index = bodyStartIndex; index < sections.items.length; index += 1) {
          const section = sections.items[index];
          await unlinkSectionFooters(section);
          await applyPageNumbersToSection(section, options, true);
          await updateSectionFooterFields(section);
        }

        for (let index = 0; index < bodyStartIndex; index += 1) {
          await clearSectionFooters(sections.items[index]);
        }
      } else {
        for (let index = 0; index < sections.items.length; index += 1) {
          await applyPageNumbersToSection(sections.items[index], options);
        }
      }

      await context.sync();

      if (options.scope === "bodyFromCursor") {
        const layoutHint = options.layout === "oddEven" ? "，奇偶页分别显示" : "";
        if (!pageRestartApplied) {
          return ok(
            `已插入页码，但未能自动从 ${startNumber} 起重编${layoutHint}。可在 Word「插入 → 页码 → 设置页码格式」中手动设置起始页`
          );
        }
        return ok(
          `已按 Word 标准流程完成：前置 ${bodyStartIndex} 节无页码，正文节从 ${startNumber} 起编${layoutHint}`
        );
      }

      const layoutHint = options.layout === "oddEven" ? "（奇右偶左）" : "";
      return ok(
        options.format === "full"
          ? `已为全文插入「第 X 页 / 共 Y 页」${layoutHint}`
          : `已为全文插入页码${layoutHint}`
      );
    });
  } catch (err) {
    return wrapError(err, "插入页码失败");
  }
}

async function clearAllPageNumberFooters(): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      await forEachSection(context, async (section) => {
        await clearSectionFooters(section);
        await setSectionOddEven(section, false);
      });

      await context.sync();
      return ok("已清除所有页脚页码");
    });
  } catch (err) {
    return wrapError(err, "清除页码失败");
  }
}

async function setHeaderFooterText(
  part: "header" | "footer",
  text: string,
  align: Word.Alignment
): Promise<DocumentToolResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return fail(`请先填写${part === "header" ? "页眉" : "页脚"}内容`);
  }

  try {
    return await Word.run(async (context) => {
      await forEachSection(context, async (section) => {
        const body =
          part === "header"
            ? section.getHeader(Word.HeaderFooterType.primary)
            : section.getFooter(Word.HeaderFooterType.primary);

        await clearBodyParagraphs(body);
        const paragraph = body.insertParagraph(trimmed, Word.InsertLocation.start);
        paragraph.alignment = align;
      });

      await context.sync();
      return ok(part === "header" ? "已设置页眉" : "已设置页脚文字");
    });
  } catch (err) {
    return wrapError(err, part === "header" ? "设置页眉失败" : "设置页脚失败");
  }
}

async function clearHeaderFooter(part: "header" | "footer"): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      await forEachSection(context, async (section) => {
        const body =
          part === "header"
            ? section.getHeader(Word.HeaderFooterType.primary)
            : section.getFooter(Word.HeaderFooterType.primary);
        await clearBodyParagraphs(body);
      });

      await context.sync();
      return ok(part === "header" ? "已清除页眉" : "已清除页脚");
    });
  } catch (err) {
    return wrapError(err, part === "header" ? "清除页眉失败" : "清除页脚失败");
  }
}

function isEmptyParagraphText(text: string | undefined): boolean {
  return !text || text.replace(/\r/g, "").trim().length === 0;
}

async function removeEmptyParagraphs(useSelection: boolean): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      const target = useSelection ? context.document.getSelection() : context.document.body;
      const paragraphs = target.paragraphs;
      paragraphs.load("items");
      await context.sync();

      for (const paragraph of paragraphs.items) {
        paragraph.load("text");
      }
      await context.sync();

      let removed = 0;
      for (let index = paragraphs.items.length - 1; index >= 0; index -= 1) {
        const paragraph = paragraphs.items[index];
        if (isEmptyParagraphText(paragraph.text)) {
          if (paragraphs.items.length - removed <= 1) break;
          paragraph.delete();
          removed += 1;
        }
      }

      await context.sync();
      if (removed === 0) {
        return ok("未发现可删除的空行");
      }
      return ok(`已删除 ${removed} 个空段落`);
    });
  } catch (err) {
    return wrapError(err, "去除空行失败");
  }
}

function isEffectivelyEmptyParagraph(text: string | undefined): boolean {
  if (!text) return true;
  return text.replace(/[\r\n\f\v\u000b\u00a0\u2000-\u200d\u202f\u205f\u3000\ufeff\s]/g, "").length === 0;
}

function paragraphOoxmlHasPageBreakBefore(ooxml: string): boolean {
  return /w:pageBreakBefore/.test(ooxml);
}

function paragraphOoxmlHasSectionBreak(ooxml: string): boolean {
  return /<w:sectPr[\s/>]/.test(ooxml);
}

function paragraphOoxmlHasManualPageBreak(ooxml: string): boolean {
  return /w:br[^>]*w:type=["']page["']/.test(ooxml);
}

function paragraphOoxmlHasForcedPageSectionStart(ooxml: string): boolean {
  return /w:type[^>]*w:val=["'](nextPage|oddPage|evenPage)["']/.test(ooxml);
}

function paragraphOoxmlHasExcessiveVerticalSpacing(ooxml: string): boolean {
  const match = ooxml.match(/w:spacing[^>]*w:before=["'](\d+)["']/);
  if (!match) return false;
  return Number(match[1]) >= 2400;
}

function isBlankPageParagraphOoxml(ooxml: string): boolean {
  if (paragraphOoxmlHasPageBreakBefore(ooxml)) return true;
  if (paragraphOoxmlHasSectionBreak(ooxml)) return true;
  if (paragraphOoxmlHasManualPageBreak(ooxml)) return true;
  if (paragraphOoxmlHasExcessiveVerticalSpacing(ooxml)) return true;
  return false;
}

function previousParagraphForcesNewPage(prevOoxml: string | undefined): boolean {
  if (!prevOoxml) return false;
  return (
    paragraphOoxmlHasPageBreakBefore(prevOoxml) ||
    paragraphOoxmlHasManualPageBreak(prevOoxml) ||
    paragraphOoxmlHasSectionBreak(prevOoxml) ||
    paragraphOoxmlHasForcedPageSectionStart(prevOoxml)
  );
}

function shouldRemoveBlankPageParagraph(
  index: number,
  texts: string[],
  ooxmlByIndex: Map<number, string | undefined>
): boolean {
  if (!isEffectivelyEmptyParagraph(texts[index])) return false;

  const ooxml = ooxmlByIndex.get(index);
  if (ooxml && isBlankPageParagraphOoxml(ooxml)) return true;

  const prevEmpty = index > 0 && isEffectivelyEmptyParagraph(texts[index - 1]);
  const nextEmpty = index < texts.length - 1 && isEffectivelyEmptyParagraph(texts[index + 1]);
  if (prevEmpty || nextEmpty) return true;

  if (index === texts.length - 1) return true;

  let followingEmpty = true;
  for (let cursor = index + 1; cursor < texts.length; cursor += 1) {
    if (!isEffectivelyEmptyParagraph(texts[cursor])) {
      followingEmpty = false;
      break;
    }
  }
  if (followingEmpty) return true;

  let leadingEmpty = true;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (!isEffectivelyEmptyParagraph(texts[cursor])) {
      leadingEmpty = false;
      break;
    }
  }
  if (leadingEmpty) return true;

  if (index > 0 && previousParagraphForcesNewPage(ooxmlByIndex.get(index - 1))) {
    return true;
  }

  return false;
}

async function loadParagraphOoxml(
  context: Word.RequestContext,
  paragraph: Word.Paragraph,
  cache: Map<number, string | undefined>,
  index: number
): Promise<string | undefined> {
  const cached = cache.get(index);
  if (cached) return cached;
  try {
    const ooxmlResult = paragraph.getOoxml();
    await context.sync();
    cache.set(index, ooxmlResult.value);
    return ooxmlResult.value;
  } catch {
    return undefined;
  }
}

function patchSectionBreakToContinuous(ooxml: string): string | null {
  if (!paragraphOoxmlHasForcedPageSectionStart(ooxml)) return null;
  const patched = ooxml
    .replace(/w:val=["']nextPage["']/g, 'w:val="continuous"')
    .replace(/w:val=["']oddPage["']/g, 'w:val="continuous"')
    .replace(/w:val=["']evenPage["']/g, 'w:val="continuous"');
  return patched === ooxml ? null : patched;
}

async function softenPageSectionBreaksAfterEmptyGap(
  context: Word.RequestContext,
  target: Word.Body | Word.Range
): Promise<number> {
  const paragraphs = target.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const paragraph of paragraphs.items) {
    paragraph.load("text");
  }
  await context.sync();

  let softened = 0;
  const ooxmlCache = new Map<number, string | undefined>();
  for (let index = 0; index < paragraphs.items.length; index += 1) {
    const ooxml = await loadParagraphOoxml(context, paragraphs.items[index], ooxmlCache, index);
    if (!ooxml || !paragraphOoxmlHasForcedPageSectionStart(ooxml)) continue;

    let nextContentIndex = -1;
    for (let cursor = index + 1; cursor < paragraphs.items.length; cursor += 1) {
      if (!isEffectivelyEmptyParagraph(paragraphs.items[cursor].text)) {
        nextContentIndex = cursor;
        break;
      }
    }

    if (nextContentIndex <= index + 1) continue;

    const gapAllEmpty = paragraphs.items
      .slice(index + 1, nextContentIndex)
      .every((paragraph) => isEffectivelyEmptyParagraph(paragraph.text));
    if (!gapAllEmpty) continue;

    const patched = patchSectionBreakToContinuous(ooxml);
    if (!patched) continue;

    try {
      paragraphs.items[index].insertOoxml(patched, Word.InsertLocation.replace);
      await context.sync();
      softened += 1;
    } catch {
      // OOXML 替换失败时跳过该段落，继续处理其余内容。
    }
  }

  return softened;
}

async function softenOrphanedPageSectionBreaks(
  context: Word.RequestContext,
  target: Word.Body | Word.Range
): Promise<number> {
  const paragraphs = target.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const paragraph of paragraphs.items) {
    paragraph.load("text");
  }
  await context.sync();

  let softened = 0;
  const ooxmlCache = new Map<number, string | undefined>();

  for (let index = 0; index < paragraphs.items.length - 1; index += 1) {
    const ooxml = await loadParagraphOoxml(context, paragraphs.items[index], ooxmlCache, index);
    if (!ooxml || !paragraphOoxmlHasForcedPageSectionStart(ooxml)) continue;
    if (isEffectivelyEmptyParagraph(paragraphs.items[index + 1].text)) continue;

    const patched = patchSectionBreakToContinuous(ooxml);
    if (!patched) continue;

    try {
      paragraphs.items[index].insertOoxml(patched, Word.InsertLocation.replace);
      await context.sync();
      softened += 1;
    } catch {
      // OOXML 替换失败时跳过该段落。
    }
  }

  return softened;
}

async function removeRemainingEmptyParagraphs(
  context: Word.RequestContext,
  target: Word.Body | Word.Range
): Promise<number> {
  const paragraphs = target.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const paragraph of paragraphs.items) {
    paragraph.load("text");
  }
  await context.sync();

  const texts = paragraphs.items.map((paragraph) => paragraph.text);
  const hasNonEmpty = texts.some((text) => !isEffectivelyEmptyParagraph(text));
  if (!hasNonEmpty) return 0;

  let removed = 0;
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    if (!isEffectivelyEmptyParagraph(texts[index])) continue;
    if (paragraphs.items.length - removed <= 1) break;
    paragraphs.items[index].delete();
    removed += 1;
  }

  await context.sync();
  return removed;
}

async function removeBlankPages(useSelection: boolean): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      const target = useSelection ? context.document.getSelection() : context.document.body;
      let totalRemoved = 0;

      for (let pass = 0; pass < 8; pass += 1) {
        const paragraphs = target.paragraphs;
        paragraphs.load("items");
        await context.sync();

        if (paragraphs.items.length <= 1) break;

        for (const paragraph of paragraphs.items) {
          paragraph.load("text");
        }
        await context.sync();

        const texts = paragraphs.items.map((paragraph) => paragraph.text);
        const ooxmlByIndex = new Map<number, string | undefined>();
        const removeFlags: boolean[] = new Array(texts.length).fill(false);

        for (let index = 0; index < texts.length; index += 1) {
          if (!isEffectivelyEmptyParagraph(texts[index])) continue;

          await loadParagraphOoxml(context, paragraphs.items[index], ooxmlByIndex, index);
          if (index > 0) {
            await loadParagraphOoxml(context, paragraphs.items[index - 1], ooxmlByIndex, index - 1);
          }

          removeFlags[index] = shouldRemoveBlankPageParagraph(index, texts, ooxmlByIndex);
        }

        let removedThisPass = 0;
        for (let index = texts.length - 1; index >= 0; index -= 1) {
          if (!removeFlags[index]) continue;
          if (paragraphs.items.length - totalRemoved - removedThisPass <= 1) break;
          paragraphs.items[index].delete();
          removedThisPass += 1;
        }

        await context.sync();
        totalRemoved += removedThisPass;
        if (removedThisPass === 0) break;
      }

      const softenedBeforeCleanup = await softenPageSectionBreaksAfterEmptyGap(context, target);
      totalRemoved += await removeRemainingEmptyParagraphs(context, target);
      const softenedAfterCleanup =
        totalRemoved > 0 ? await softenOrphanedPageSectionBreaks(context, target) : 0;
      totalRemoved += await removeRemainingEmptyParagraphs(context, target);

      const softenedBreaks = softenedBeforeCleanup + softenedAfterCleanup;

      if (totalRemoved === 0 && softenedBreaks === 0) {
        return ok("未发现导致空白页的空段落");
      }
      if (softenedBreaks > 0 && totalRemoved === 0) {
        return ok(`已调整 ${softenedBreaks} 处分节符，避免产生空白页`);
      }
      if (softenedBreaks > 0) {
        return ok(`已删除 ${totalRemoved} 个空段落，并调整 ${softenedBreaks} 处分节符`);
      }
      return ok(`已删除 ${totalRemoved} 个导致空白页的空段落`);
    });
  } catch (err) {
    return wrapError(err, "去除空白页失败");
  }
}

async function trimExtraSpaces(useSelection: boolean): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      const target = useSelection ? context.document.getSelection() : context.document.body;
      const paragraphs = target.paragraphs;
      paragraphs.load("items");
      await context.sync();

      let changed = 0;
      for (const paragraph of paragraphs.items) {
        paragraph.load("text");
      }
      await context.sync();

      for (const paragraph of paragraphs.items) {
        const original = paragraph.text?.replace(/\r/g, "") ?? "";
        const normalized = original.replace(/[ \t\u3000]+/g, " ").trim();
        if (normalized !== original.trim()) {
          paragraph.insertText(normalized, Word.InsertLocation.replace);
          changed += 1;
        }
      }

      await context.sync();
      return ok(changed > 0 ? `已整理 ${changed} 个段落空格` : "未发现多余空格");
    });
  } catch (err) {
    return wrapError(err, "整理空格失败");
  }
}

async function formatAcademicVariables(): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load("isEmpty,text");
      const ooxmlResult = selection.getOoxml();
      await context.sync();

      if (selection.isEmpty || !selection.text?.trim()) {
        return fail("请先选中包含变量字母的段落");
      }

      const patched = patchAcademicVariablesInOoxml(ooxmlResult.value);
      if (patched.error) {
        return fail(patched.error);
      }
      if (patched.convertedCount === 0) {
        return ok("未识别到可优化的变量字母；仅处理独立字母及 R_s、w_i 等下标写法");
      }

      selection.insertOoxml(patched.ooxml, Word.InsertLocation.replace);
      await context.sync();
      return ok(`已将 ${patched.convertedCount} 处变量转换为 Word 学术数学格式`);
    });
  } catch (err) {
    return wrapError(err, "段落字母排版优化失败");
  }
}

type LineSpacingPreset = NonNullable<DocumentToolOptions["lineSpacingPreset"]>;

function getLineSpacingConfig(preset: LineSpacingPreset | undefined): {
  line: number;
  rule: "auto" | "exact";
  label: string;
} {
  switch (preset) {
    case "single":
      return { line: 240, rule: "auto", label: "单倍行距" };
    case "1.5":
      return { line: 360, rule: "auto", label: "1.5 倍行距" };
    case "2":
      return { line: 480, rule: "auto", label: "2 倍行距" };
    case "fixed20":
      return { line: 400, rule: "exact", label: "固定 20 磅" };
    case "fixed22":
      return { line: 440, rule: "exact", label: "固定 22 磅" };
    case "fixed24":
      return { line: 480, rule: "exact", label: "固定 24 磅" };
    default:
      return { line: 360, rule: "auto", label: "1.5 倍行距" };
  }
}

function patchParagraphLineSpacingOoxml(
  ooxml: string,
  line: number,
  rule: "auto" | "exact"
): string {
  const spacing = `<w:spacing w:line="${line}" w:lineRule="${rule}"/>`;
  if (/<w:spacing\b/.test(ooxml)) {
    return ooxml
      .replace(/<w:spacing\b[^>]*\/>/g, spacing)
      .replace(/<w:spacing\b[^>]*>[\s\S]*?<\/w:spacing>/g, spacing);
  }
  if (/<w:pPr\b/.test(ooxml)) {
    return ooxml.replace(/<w:pPr\b([^>]*)>/, `<w:pPr$1>${spacing}`);
  }
  return ooxml.replace(/<w:p\b([^>]*)>/, `<w:p$1><w:pPr>${spacing}</w:pPr>`);
}

async function setUniformLineSpacing(
  useSelection: boolean,
  preset: LineSpacingPreset | undefined
): Promise<DocumentToolResult> {
  const config = getLineSpacingConfig(preset);

  try {
    return await Word.run(async (context) => {
      const target = useSelection ? context.document.getSelection() : context.document.body;
      const paragraphs = target.paragraphs;
      paragraphs.load("items");
      await context.sync();

      for (const paragraph of paragraphs.items) {
        paragraph.load("text");
      }
      await context.sync();

      let changed = 0;
      const ooxmlCache = new Map<number, string | undefined>();

      for (let index = 0; index < paragraphs.items.length; index += 1) {
        const paragraph = paragraphs.items[index];
        const text = paragraph.text?.replace(/\r/g, "").trim() ?? "";
        if (!text) continue;

        const ooxml = await loadParagraphOoxml(context, paragraph, ooxmlCache, index);
        if (!ooxml) continue;

        const patched = patchParagraphLineSpacingOoxml(ooxml, config.line, config.rule);
        try {
          paragraph.insertOoxml(patched, Word.InsertLocation.replace);
          await context.sync();
          changed += 1;
        } catch {
          // OOXML 替换失败时跳过该段落。
        }
      }

      if (changed === 0) {
        return ok(useSelection ? "选区内未找到可设置行距的段落" : "未找到可设置行距的段落");
      }
      return ok(`已为 ${changed} 个段落设置${config.label}`);
    });
  } catch (err) {
    return wrapError(err, "设置行距失败");
  }
}

async function setFirstLineIndent(enable: boolean, indentChars = 2): Promise<DocumentToolResult> {
  try {
    return await Word.run(async (context) => {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items");
      await context.sync();

      let changed = 0;
      for (const paragraph of paragraphs.items) {
        paragraph.load("text");
        paragraph.font.load("size");
      }
      await context.sync();

      const chars = Math.min(8, Math.max(1, indentChars));

      for (const paragraph of paragraphs.items) {
        const text = paragraph.text?.replace(/\r/g, "").trim() ?? "";
        if (!text) continue;

        if (enable) {
          const fontSize = paragraph.font.size || 12;
          paragraph.firstLineIndent = fontSize * chars;
        } else {
          paragraph.firstLineIndent = 0;
        }
        changed += 1;
      }

      await context.sync();
      return ok(
        enable ? `已为 ${changed} 个段落设置 ${chars} 字符首行缩进` : `已清除 ${changed} 个段落的首行缩进`
      );
    });
  } catch (err) {
    return wrapError(err, "设置首行缩进失败");
  }
}

async function insertTableOfContents(
  upperLevel: number,
  lowerLevel: number
): Promise<DocumentToolResult> {
  const upper = clampLevel(upperLevel, 1);
  const lower = Math.max(upper, clampLevel(lowerLevel, 9));
  const levelRange = `${upper}–${lower} 级`;

  try {
    return await Word.run(async (context) => {
      const range = context.document.getSelection().getRange();
      const document = context.document;
      const tocAddOptions = {
        useBuiltInHeadingStyles: true,
        useOutlineLevels: true,
        upperHeadingLevel: upper,
        lowerHeadingLevel: lower,
        includePageNumbers: true,
        rightAlignPageNumbers: true,
      };

      if (document.tablesOfContents) {
        try {
          const toc = document.tablesOfContents.add(range, tocAddOptions);
          toc.updatePageNumbers();
          await context.sync();
          return ok(`已在光标处插入目录（${levelRange}）`);
        } catch {
          // fall through to TOC field
        }
      }

      const field = range.insertField(
        Word.InsertLocation.replace,
        Word.FieldType.toc,
        `TOC \\o "${upper}-${lower}" \\h \\z \\u`,
        true
      );
      field.updateResult();
      await context.sync();
      return ok(`已在光标处插入目录（${levelRange}）`);
    });
  } catch (err) {
    return wrapError(err, "插入目录失败，请先用「设置大纲级别」标记标题段落");
  }
}

function resolveApplyScope(options: DocumentToolOptions): boolean {
  return options.applyScope === "selection";
}

export async function runDocumentTool(
  toolId: string,
  options: DocumentToolOptions = {}
): Promise<DocumentToolResult> {
  switch (toolId) {
    case "insert-toc":
      return insertTableOfContents(options.tocUpperLevel ?? 1, options.tocLowerLevel ?? 3);

    case "update-toc":
      try {
        return await Word.run(async (context) => {
          let updated = 0;
          const document = context.document;

          if (document.tablesOfContents) {
            const collection = document.tablesOfContents;
            collection.load("items");
            await context.sync();
            for (const item of collection.items) {
              item.updatePageNumbers();
              updated += 1;
            }
          }

          const fields = document.body.fields;
          fields.load("items");
          await context.sync();
          for (const field of fields.items) {
            field.load("type");
          }
          await context.sync();
          for (const field of fields.items) {
            if (field.type === "TOC") {
              field.updateResult();
              updated += 1;
            }
          }

          await context.sync();
          return updated > 0 ? ok(`已更新 ${updated} 个目录`) : ok("未找到目录，可先插入目录");
        });
      } catch (err) {
        return wrapError(err, "更新目录失败");
      }

    case "insert-page-number":
      return insertPageNumbers({
        align: options.pageNumberAlign || "center",
        format: options.pageNumberFormat || "simple",
        scope: options.pageNumberScope || "bodyFromCursor",
        layout: options.pageNumberLayout || "uniform",
        startNumber: options.pageNumberStart ?? 1,
      });

    case "clear-page-numbers":
      return clearAllPageNumberFooters();

    case "set-header":
      return setHeaderFooterText(
        "header",
        options.headerText || "",
        toWordAlignment(options.headerAlign || "center")
      );

    case "set-footer-text":
      return setHeaderFooterText(
        "footer",
        options.footerText || "",
        toWordAlignment(options.footerAlign || "center")
      );

    case "clear-header":
      return clearHeaderFooter("header");

    case "clear-footer":
      return clearHeaderFooter("footer");

    case "remove-empty-lines":
      return removeEmptyParagraphs(resolveApplyScope(options));

    case "remove-blank-pages":
      return removeBlankPages(resolveApplyScope(options));

    case "trim-extra-spaces":
      return trimExtraSpaces(resolveApplyScope(options));

    case "set-heading-level":
      return setSelectionOutlineLevel(options.outlineLevel ?? 1);

    case "format-academic-variables":
      return formatAcademicVariables();

    case "indent-first-line":
      return setFirstLineIndent(true, options.indentChars ?? 2);

    case "clear-first-line-indent":
      return setFirstLineIndent(false);

    case "uniform-line-spacing":
      return setUniformLineSpacing(
        resolveApplyScope(options),
        options.lineSpacingPreset ?? "1.5"
      );

    default:
      return fail("未知工具");
  }
}

export function buildDocumentToolOptions(
  _toolId: string,
  fieldValues: Record<string, string>
): DocumentToolOptions {
  return {
    headerText: fieldValues.headerText,
    footerText: fieldValues.footerText,
    headerAlign: fieldValues.headerAlign as DocumentToolOptions["headerAlign"],
    footerAlign: fieldValues.footerAlign as DocumentToolOptions["footerAlign"],
    tocUpperLevel: Number(fieldValues.tocUpperLevel) || 1,
    tocLowerLevel: Number(fieldValues.tocLowerLevel) || 3,
    pageNumberAlign: fieldValues.pageNumberAlign as DocumentToolOptions["pageNumberAlign"],
    pageNumberFormat: fieldValues.pageNumberFormat as DocumentToolOptions["pageNumberFormat"],
    pageNumberScope: fieldValues.pageNumberScope as DocumentToolOptions["pageNumberScope"],
    pageNumberLayout: fieldValues.pageNumberLayout as DocumentToolOptions["pageNumberLayout"],
    pageNumberStart: Number(fieldValues.pageNumberStart) || 1,
    indentChars: Number(fieldValues.indentChars) || 2,
    applyScope: fieldValues.applyScope as DocumentToolOptions["applyScope"],
    lineSpacingPreset: fieldValues.lineSpacingPreset as DocumentToolOptions["lineSpacingPreset"],
    outlineLevel:
      fieldValues.outlineLevel === "bodyText"
        ? "bodyText"
        : clampOutlineLevel(Number(fieldValues.outlineLevel || fieldValues.headingLevel) || 1),
  };
}
