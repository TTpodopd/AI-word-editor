import temml from "temml";

let mml2ommlFn: ((mathml: string) => string) | null = null;

async function getMml2Omml() {
  if (!mml2ommlFn) {
    const mod = await import("mathml2omml");
    mml2ommlFn = mod.mml2omml;
  }
  return mml2ommlFn;
}

export function normalizeLatexInput(raw: string): string {
  let latex = String(raw || "").trim();
  if (!latex) return "";

  latex = latex.replace(/\r\n/g, "\n").replace(/\s*\n+\s*/g, " ");

  if (latex.startsWith("$$") && latex.endsWith("$$") && latex.length > 4) {
    latex = latex.slice(2, -2).trim();
  } else if (latex.startsWith("$") && latex.endsWith("$") && latex.length > 2) {
    latex = latex.slice(1, -1).trim();
  }

  return latex.replace(/\s{2,}/g, " ").trim();
}

export function extractLatexPreset(text: string): { latex: string; displayMode: boolean } {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { latex: "", displayMode: false };

  if (
    (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) ||
    (trimmed.startsWith("\\[") && trimmed.endsWith("\\]"))
  ) {
    return { latex: normalizeLatexInput(trimmed), displayMode: true };
  }

  if (trimmed.startsWith("\\(") && trimmed.endsWith("\\)")) {
    return { latex: trimmed.slice(2, -2).trim(), displayMode: false };
  }

  return { latex: normalizeLatexInput(trimmed), displayMode: false };
}

export function looksLikeLatex(text: string): boolean {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;

  if (/\\\[|\\\]|\\\(|\\\)|\$\$?/.test(trimmed)) return true;
  if (/\\[a-zA-Z@]+/.test(trimmed)) return true;

  return /[\^_]/.test(trimmed) && /[{}\\]/.test(trimmed);
}

function extractOmmlElementAt(xml: string, start: number): { element: string; end: number } | null {
  let index = start;
  while (index < xml.length && /\s/.test(xml[index])) index += 1;
  if (xml[index] !== "<") return null;

  const openMatch = xml.slice(index).match(/^<(m:[A-Za-z]+)([^>]*?)>/);
  if (!openMatch) return null;

  const tag = openMatch[1];
  if (openMatch[0].endsWith("/>")) {
    return { element: openMatch[0], end: index + openMatch[0].length };
  }

  const closeTag = `</${tag}>`;
  let depth = 1;
  let pos = index + openMatch[0].length;

  while (depth > 0 && pos < xml.length) {
    const rest = xml.slice(pos);
    const nextOpen = rest.search(new RegExp(`<${tag}(?:\\s[^>]*)?>`));
    const nextClose = rest.indexOf(closeTag);
    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      pos += nextOpen + 1;
      continue;
    }

    depth -= 1;
    pos += nextClose + closeTag.length;
  }

  return { element: xml.slice(index, pos), end: pos };
}

function fixEmptyNaryOperands(omml: string): string {
  const marker = /<m:e\s*\/>[\s]*<\/m:nary>/g;
  let result = omml;
  let match: RegExpExecArray | null;
  let safety = 0;

  while ((match = marker.exec(result)) && safety < 32) {
    safety += 1;
    const idx = match.index;
    const after = idx + match[0].length;
    const next = extractOmmlElementAt(result, after);
    if (!next) continue;

    result =
      result.slice(0, idx) +
      `<m:e>${next.element}</m:e></m:nary>` +
      result.slice(next.end);
    marker.lastIndex = idx + `<m:e>${next.element}</m:e></m:nary>`.length;
  }

  return result;
}

function buildWordOoxmlPackage(omml: string, displayMode: boolean): string {
  const bodyContent = displayMode
    ? `<w:p><m:oMathPara>${omml}</m:oMathPara></w:p>`
    : `<w:p>${omml}</w:p>`;

  return `<?xml version="1.0" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
  <pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml" pkg:padding="512">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
    <pkg:xmlData>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
        <w:body>
          ${bodyContent}
        </w:body>
      </w:document>
    </pkg:xmlData>
  </pkg:part>
</pkg:package>`;
}

export async function convertLatexToOoxml(
  latex: string,
  displayMode = false
): Promise<{ ooxml: string; error?: string }> {
  const normalized = normalizeLatexInput(latex);
  if (!normalized) {
    return { ooxml: "", error: "公式不能为空" };
  }

  let mathml: string;
  try {
    mathml = temml.renderToString(normalized, { displayMode: !!displayMode });
  } catch (err) {
    return {
      ooxml: "",
      error: err instanceof Error ? err.message : "LaTeX 语法无效，请检查括号是否配对",
    };
  }

  try {
    const mml2omml = await getMml2Omml();
    const omml = fixEmptyNaryOperands(mml2omml(mathml));
    if (!omml?.trim()) {
      return { ooxml: "", error: "公式转换失败" };
    }

    return { ooxml: buildWordOoxmlPackage(omml, !!displayMode) };
  } catch (err) {
    return {
      ooxml: "",
      error: err instanceof Error ? err.message : "公式转换失败",
    };
  }
}
