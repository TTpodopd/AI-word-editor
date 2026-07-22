const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MATH_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const VARIABLE_CHAR_PATTERN = /^[A-Za-zΑ-Ωα-ω]$/;
const VARIABLE_TOKEN_CHAR_PATTERN = /^[A-Za-z0-9_Α-Ωα-ω]$/;
const SUBSCRIPT_TOKEN_PATTERN = /^([A-Za-zΑ-Ωα-ω])_([A-Za-z0-9Α-Ωα-ω]+(?:_[A-Za-z0-9Α-Ωα-ω]+)*)$/;

interface VariableSegment {
  text: string;
  variable?: {
    base: string;
    subscript?: string;
  };
}

export interface AcademicVariablePatchResult {
  ooxml: string;
  convertedCount: number;
  error?: string;
}

function isVariableCharacter(char: string): boolean {
  return VARIABLE_CHAR_PATTERN.test(char);
}

function isVariableTokenCharacter(char: string): boolean {
  return VARIABLE_TOKEN_CHAR_PATTERN.test(char);
}

function isElementNode(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function parseVariableToken(token: string): VariableSegment["variable"] | null {
  if (token.length === 1 && isVariableCharacter(token)) {
    return { base: token };
  }

  const subscriptMatch = token.match(SUBSCRIPT_TOKEN_PATTERN);
  if (!subscriptMatch) return null;

  return {
    base: subscriptMatch[1],
    subscript: subscriptMatch[2].replace(/_/g, ","),
  };
}

function splitVariableSegments(text: string): VariableSegment[] {
  const segments: VariableSegment[] = [];
  let cursor = 0;
  let plainStart = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) {
      segments.push({ text: text.slice(plainStart, end) });
    }
  };

  while (cursor < text.length) {
    if (!isVariableTokenCharacter(text[cursor])) {
      cursor += 1;
      continue;
    }

    const tokenStart = cursor;
    while (cursor < text.length && isVariableTokenCharacter(text[cursor])) {
      cursor += 1;
    }

    const token = text.slice(tokenStart, cursor);
    const variable = parseVariableToken(token);
    if (!variable) continue;

    pushPlain(tokenStart);
    segments.push({ text: token, variable });
    plainStart = cursor;
  }

  pushPlain(text.length);
  return segments;
}

function hasMathOrLinkAncestor(node: Node): boolean {
  let parent = node.parentNode as Node | null;
  while (parent) {
    if (isElementNode(parent)) {
      if (
        (parent.namespaceURI === MATH_NS && parent.localName === "oMath") ||
        (parent.namespaceURI === WORD_NS && parent.localName === "hyperlink")
      ) {
        return true;
      }
    }
    parent = parent.parentNode as Node | null;
  }
  return false;
}

function createWordTextRun(doc: Document, text: string, sourceRun: Element): Element {
  const run = doc.createElementNS(WORD_NS, "w:r");
  const runProperties = Array.from(sourceRun.childNodes).find(
    (node) =>
      isElementNode(node) &&
      node.namespaceURI === WORD_NS &&
      node.localName === "rPr"
  );
  if (runProperties) {
    run.appendChild(runProperties.cloneNode(true));
  }

  const textNode = doc.createElementNS(WORD_NS, "w:t");
  if (/^\s|\s$/.test(text)) {
    textNode.setAttributeNS(XML_NS, "xml:space", "preserve");
  }
  textNode.textContent = text;
  run.appendChild(textNode);
  return run;
}

function createMathRun(doc: Document, text: string, italic: boolean): Element {
  const run = doc.createElementNS(MATH_NS, "m:r");
  if (italic && /[A-Za-zΑ-Ωα-ω]/.test(text)) {
    const properties = doc.createElementNS(MATH_NS, "m:rPr");
    const style = doc.createElementNS(MATH_NS, "m:sty");
    style.setAttributeNS(MATH_NS, "m:val", "i");
    properties.appendChild(style);
    run.appendChild(properties);
  }

  const mathText = doc.createElementNS(MATH_NS, "m:t");
  mathText.textContent = text;
  run.appendChild(mathText);
  return run;
}

function createMathVariable(
  doc: Document,
  variable: NonNullable<VariableSegment["variable"]>
): Element {
  const math = doc.createElementNS(MATH_NS, "m:oMath");

  if (!variable.subscript) {
    math.appendChild(createMathRun(doc, variable.base, true));
    return math;
  }

  const subscript = doc.createElementNS(MATH_NS, "m:sSub");
  const base = doc.createElementNS(MATH_NS, "m:e");
  base.appendChild(createMathRun(doc, variable.base, true));

  const sub = doc.createElementNS(MATH_NS, "m:sub");
  sub.appendChild(createMathRun(doc, variable.subscript, true));

  subscript.appendChild(base);
  subscript.appendChild(sub);
  math.appendChild(subscript);
  return math;
}

function isSimpleTextRun(run: Element, textElement: Element): boolean {
  const textElements = Array.from(run.childNodes).filter(
    (node): node is Element =>
      isElementNode(node) && node.namespaceURI === WORD_NS && node.localName === "t"
  );
  if (textElements.length !== 1 || textElements[0] !== textElement) return false;

  return Array.from(run.childNodes).every(
    (node) =>
      !isElementNode(node) ||
      (node.namespaceURI === WORD_NS && (node.localName === "rPr" || node.localName === "t"))
  );
}

export function patchAcademicVariablesInOoxml(ooxml: string): AcademicVariablePatchResult {
  if (!ooxml.trim()) {
    return { ooxml, convertedCount: 0, error: "选区内容为空" };
  }

  try {
    const doc = new DOMParser().parseFromString(ooxml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
      return { ooxml, convertedCount: 0, error: "无法解析选区内容" };
    }

    const textElements = Array.from(doc.getElementsByTagNameNS(WORD_NS, "t"));
    let convertedCount = 0;

    for (const textElement of textElements) {
      if (hasMathOrLinkAncestor(textElement)) continue;

      const sourceRun = textElement.parentElement;
      const runParent = sourceRun?.parentNode;
      if (
        !sourceRun ||
        sourceRun.namespaceURI !== WORD_NS ||
        sourceRun.localName !== "r" ||
        !runParent ||
        !isSimpleTextRun(sourceRun, textElement)
      ) {
        continue;
      }

      const text = textElement.textContent || "";
      const segments = splitVariableSegments(text);
      const variableCount = segments.filter((segment) => segment.variable).length;
      if (variableCount === 0) continue;

      const fragment = doc.createDocumentFragment();
      for (const segment of segments) {
        if (segment.variable) {
          fragment.appendChild(createMathVariable(doc, segment.variable));
        } else if (segment.text) {
          fragment.appendChild(createWordTextRun(doc, segment.text, sourceRun));
        }
      }

      runParent.replaceChild(fragment, sourceRun);
      convertedCount += variableCount;
    }

    return {
      ooxml: new XMLSerializer().serializeToString(doc),
      convertedCount,
    };
  } catch {
    return { ooxml, convertedCount: 0, error: "字母排版转换失败" };
  }
}
