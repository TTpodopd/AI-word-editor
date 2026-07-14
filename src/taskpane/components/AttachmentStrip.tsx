import React from "react";
import { PendingAttachment } from "../types";

interface AttachmentStripProps {
  attachments: PendingAttachment[];
  disabled?: boolean;
  onRemove: (id: string) => void;
}

function ImageIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2 3h12v10H2V3zm1 1v6.3l2.5-2.5 2 2L11 7.5 13 10V4H3zm2.2 1.5a1 1 0 110 2 1 1 0 010-2z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 2h5.5L13 5.5V14H4V2zm6 1.5V6h2.5L10 3.5zM5 7h6v1H5V7zm0 2h6v1H5V9zm0 2h4v1H5v-1z" />
    </svg>
  );
}

export function AttachmentStrip({ attachments, disabled, onRemove }: AttachmentStripProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="attachment-strip">
      {attachments.map((item) => (
        <div key={item.id} className={`attachment-chip attachment-chip--${item.kind}`}>
          {item.kind === "image" && item.previewUrl ? (
            <img className="attachment-thumb" src={item.previewUrl} alt={item.name} />
          ) : (
            <span className="attachment-chip-icon">{item.kind === "image" ? <ImageIcon /> : <DocIcon />}</span>
          )}
          <span className="attachment-chip-name" title={item.name}>
            {item.name}
          </span>
          {item.kind === "document" && item.textPreview && (
            <span className="attachment-chip-preview">{item.textPreview}</span>
          )}
          <button
            type="button"
            className="attachment-chip-remove"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
            title="移除"
            aria-label={`移除 ${item.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
