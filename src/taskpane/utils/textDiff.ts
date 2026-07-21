export interface DiffSegment {
  type: "equal" | "delete" | "insert";
  text: string;
}

export interface TextDiffResult {
  originalSegments: DiffSegment[];
  revisedSegments: DiffSegment[];
  hasChanges: boolean;
  diffLimited: boolean;
}

const MAX_DIFF_CHARS = 2500;

function normalizeDiffText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];

  const merged: DiffSegment[] = [{ ...segments[0] }];
  for (let i = 1; i < segments.length; i++) {
    const current = segments[i];
    const last = merged[merged.length - 1];
    if (last.type === current.type) {
      last.text += current.text;
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function diffChars(original: string, revised: string): TextDiffResult {
  const a = [...original];
  const b = [...revised];
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const originalSegments: DiffSegment[] = [];
  const revisedSegments: DiffSegment[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      originalSegments.unshift({ type: "equal", text: a[i - 1] });
      revisedSegments.unshift({ type: "equal", text: b[j - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      revisedSegments.unshift({ type: "insert", text: b[j - 1] });
      j -= 1;
    } else if (i > 0) {
      originalSegments.unshift({ type: "delete", text: a[i - 1] });
      i -= 1;
    }
  }

  return {
    originalSegments: mergeSegments(originalSegments),
    revisedSegments: mergeSegments(revisedSegments),
    hasChanges: original !== revised,
    diffLimited: false,
  };
}

export function buildTextDiff(original: string, revised: string): TextDiffResult {
  const normalizedOriginal = normalizeDiffText(original);
  const normalizedRevised = normalizeDiffText(revised);

  if (normalizedOriginal === normalizedRevised) {
    return {
      originalSegments: [{ type: "equal", text: normalizedOriginal }],
      revisedSegments: [{ type: "equal", text: normalizedRevised }],
      hasChanges: false,
      diffLimited: false,
    };
  }

  if (normalizedOriginal.length > MAX_DIFF_CHARS || normalizedRevised.length > MAX_DIFF_CHARS) {
    return {
      originalSegments: [{ type: "equal", text: normalizedOriginal }],
      revisedSegments: [{ type: "equal", text: normalizedRevised }],
      hasChanges: true,
      diffLimited: true,
    };
  }

  return diffChars(normalizedOriginal, normalizedRevised);
}

export function getSegmentPlainText(segments: DiffSegment[]): string {
  return segments.map((segment) => segment.text).join("");
}
