import { ChatMessage, ChatMessageContent, MessageAttachment, PendingAttachment, ChatMessageContentPart, ChatMessageImagePart } from "../types";

const MAX_DOCUMENT_CHARS = 120000;

export function buildDocumentTextBlock(attachments: PendingAttachment[]): string {
  const blocks = attachments
    .filter((item) => item.kind === "document" && item.textContent?.trim())
    .map((item) => `【文档：${item.name}】\n${item.textContent!.trim().slice(0, MAX_DOCUMENT_CHARS)}`);

  return blocks.join("\n\n");
}

export function buildMultimodalUserContent(
  text: string,
  attachments: PendingAttachment[]
): ChatMessageContent {
  const imageAttachments = attachments.filter((item) => item.kind === "image" && item.imageDataUrl);
  const documentText = buildDocumentTextBlock(attachments);

  let mergedText = text.trim();
  if (documentText) {
    mergedText = mergedText ? `${mergedText}\n\n${documentText}` : documentText;
  }
  if (!mergedText && imageAttachments.length === 0) {
    mergedText = "请分析附件内容。";
  }

  if (imageAttachments.length === 0) {
    return mergedText;
  }

  const parts: Array<ChatMessageContentPart | ChatMessageImagePart> = [];
  if (mergedText) {
    parts.push({ type: "text", text: mergedText });
  }
  imageAttachments.forEach((item) => {
    parts.push({
      type: "image_url",
      image_url: { url: item.imageDataUrl! },
    });
  });

  return parts;
}

export function toUiAttachments(attachments: PendingAttachment[]): MessageAttachment[] {
  return attachments.map((item) => ({
    id: item.id,
    kind: item.kind,
    name: item.name,
    previewUrl: item.previewUrl,
    textPreview:
      item.kind === "document"
        ? item.textContent?.trim().slice(0, 80) || item.name
        : undefined,
  }));
}

export function getTextFromMessageContent(content: ChatMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function appendTextToMessageContent(
  content: ChatMessageContent,
  suffix: string
): ChatMessageContent {
  if (!suffix) return content;
  if (typeof content === "string") return `${content}${suffix}`;

  const parts = content.map((part) => ({ ...part }));
  const textIndex = parts.findIndex((part) => part.type === "text");
  if (textIndex >= 0 && parts[textIndex].type === "text") {
    parts[textIndex] = { type: "text", text: `${parts[textIndex].text}${suffix}` };
    return parts;
  }

  return [{ type: "text", text: suffix }, ...parts];
}

export function historyMessageToApiContent(message: {
  content: string;
  attachments?: MessageAttachment[];
}): ChatMessageContent {
  if (!message.attachments?.length) return message.content;

  const attachmentSummary = message.attachments
    .map((item) => (item.kind === "image" ? `[图片：${item.name}]` : `[文档：${item.name}]`))
    .join(" ");

  if (!message.content.trim()) {
    return `（用户曾发送附件：${attachmentSummary}）`;
  }

  return `${message.content}\n（附件：${attachmentSummary}）`;
}
