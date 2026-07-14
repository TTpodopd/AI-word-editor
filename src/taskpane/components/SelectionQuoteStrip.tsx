import React from "react";

interface SelectionQuoteStripProps {
  text: string;
  charCount: number;
}

export function SelectionQuoteStrip({ text, charCount }: SelectionQuoteStripProps) {
  const preview = text.length > 72 ? `${text.slice(0, 72)}…` : text;

  return (
    <div className="selection-quote-strip">
      <span className="selection-quote-label">引用内容</span>
      <span className="selection-quote-meta">{charCount} 字</span>
      <span className="selection-quote-preview" title={text}>
        {preview}
      </span>
    </div>
  );
}
