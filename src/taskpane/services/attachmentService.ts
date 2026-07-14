import { PendingAttachment, createId } from "../types";
import { apiFetch } from "./apiClient";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 12 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm", ".log"]);

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`无法读取文件：${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`无法读取文件：${file.name}`));
    reader.readAsText(file);
  });
}

async function extractDocumentText(file: File): Promise<string> {
  const extension = getExtension(file.name);

  if (TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/")) {
    return readFileAsText(file);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const dataBase64 = dataUrl.split(",")[1] || "";

  const response = await apiFetch("/api/parse-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      dataBase64,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `文档解析失败 (${response.status})`);
  }

  return String(data.text || "").trim();
}

export async function createAttachmentFromFile(file: File): Promise<PendingAttachment> {
  const extension = getExtension(file.name);
  const isImage = IMAGE_MIME_TYPES.has(file.type) || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(extension);

  if (isImage) {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`图片过大（${file.name}），请使用 8MB 以内的文件`);
    }

    const imageDataUrl = await readFileAsDataUrl(file);
    return {
      id: createId(),
      kind: "image",
      name: file.name,
      mimeType: file.type || "image/png",
      imageDataUrl,
      previewUrl: imageDataUrl,
    };
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error(`文档过大（${file.name}），请使用 12MB 以内的文件`);
  }

  const textContent = await extractDocumentText(file);
  if (!textContent) {
    throw new Error(`未能从文档中提取文本：${file.name}`);
  }

  return {
    id: createId(),
    kind: "document",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    textContent,
    textPreview: textContent.slice(0, 80),
  };
}

export async function createDocumentAttachmentFromText(
  name: string,
  textContent: string
): Promise<PendingAttachment> {
  const trimmed = textContent.trim();
  if (!trimmed) {
    throw new Error("文档内容为空");
  }

  return {
    id: createId(),
    kind: "document",
    name,
    mimeType: "text/plain",
    textContent: trimmed.slice(0, 120000),
    textPreview: trimmed.slice(0, 80),
  };
}

export const ACCEPTED_UPLOAD_TYPES =
  "image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.html,.htm,.log";
