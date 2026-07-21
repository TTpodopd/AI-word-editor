export type SelectionContentKind = "text" | "code";

const CODE_KEYWORD_PATTERN =
  /\b(function|const|let|var|return|if|else|for|while|class|import|export|from|def|async|await|public|private|protected|static|void|int|float|double|bool|string|namespace|struct|enum|switch|case|break|continue|try|catch|throw|new|this|super|extends|implements|interface|typedef|using|include|printf|println|console\.log|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|BEGIN|END|DECLARE|GO)\b/i;

const CODE_LINE_PREFIX_PATTERN =
  /^\s*(#include|#define|#pragma|import\s+|from\s+\S+\s+import|package\s+|using\s+|public\s+class|private\s+class|interface\s+|struct\s+|enum\s+|fn\s+|func\s+|sub\s+|dim\s+|<?php|<\?)/i;

function scoreCodeLine(line: string): number {
  const trimmed = line.trim();
  if (!trimmed) return 0;

  let score = 0;
  if (CODE_LINE_PREFIX_PATTERN.test(trimmed)) score += 4;
  if (/^(#|\/\/|\/\*|\*|--|<!--)/.test(trimmed)) score += 2;
  if (CODE_KEYWORD_PATTERN.test(trimmed)) score += 2;
  if (/[{}\[\]();=<>]|=>|\+\+|::|->|\|\||&&/.test(trimmed)) score += 1;
  if (/^\s*(if|for|while|switch|catch)\s*\(/.test(trimmed)) score += 2;
  if (/^\s*(public|private|protected|static)\s+/.test(trimmed)) score += 2;
  return score;
}

export function detectSelectionContentKind(text: string): SelectionContentKind {
  const trimmed = text.trim();
  if (!trimmed) return "text";

  if (/```[\s\S]*```/.test(trimmed)) return "code";

  const lines = trimmed.split(/\r?\n/);
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);
  if (nonEmptyLines.length === 0) return "text";

  let totalScore = 0;
  for (const line of nonEmptyLines) {
    totalScore += scoreCodeLine(line);
  }

  const averageScore = totalScore / nonEmptyLines.length;
  const strongCodeLines = nonEmptyLines.filter((line) => scoreCodeLine(line) >= 3).length;
  const codeLineRatio = strongCodeLines / nonEmptyLines.length;

  if (totalScore >= 6 && averageScore >= 1.8) return "code";
  if (strongCodeLines >= 2 && codeLineRatio >= 0.34) return "code";
  if (nonEmptyLines.length === 1 && totalScore >= 4) return "code";

  return "text";
}

export function getSelectionContentKindLabel(kind: SelectionContentKind): string {
  return kind === "code" ? "代码" : "文本";
}
