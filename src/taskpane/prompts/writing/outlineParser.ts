import { WritingOutlineSection, createId } from "../../types";

interface ParsedOutlinePayload {
  title?: string;
  sections?: Array<{
    id?: string;
    level?: number;
    title?: string;
    brief?: string;
  }>;
}

function normalizeLevel(level: number | undefined): 1 | 2 | 3 {
  if (level === 2) return 2;
  if (level === 3) return 3;
  return 1;
}

export function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

export function parseOutlineResponse(text: string): { title: string; sections: WritingOutlineSection[] } | null {
  try {
    const payload = JSON.parse(extractJsonBlock(text)) as ParsedOutlinePayload;
    if (!payload.sections || !Array.isArray(payload.sections) || payload.sections.length === 0) {
      return null;
    }

    const sections: WritingOutlineSection[] = [];
    for (const item of payload.sections) {
      if (!item?.title?.trim()) continue;
      sections.push({
        id: item.id?.trim() || createId(),
        level: normalizeLevel(item.level),
        title: item.title.trim(),
        brief: item.brief?.trim() || "",
        status: "pending",
      });
    }

    if (sections.length === 0) return null;

    return {
      title: payload.title?.trim() || sections[0].title,
      sections,
    };
  } catch {
    return null;
  }
}

export function summarizeSectionContent(content: string, maxChars = 200): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

export function buildOutlineTitlesList(sections: WritingOutlineSection[]): string {
  return sections.map((section) => `${"  ".repeat(section.level - 1)}${section.title}`).join("\n");
}
