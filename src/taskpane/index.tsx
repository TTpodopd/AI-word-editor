import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ensureOfficeReady } from "./services/storageService";
import "./styles/theme.css";

const container = document.getElementById("container");

function isWordHost(): boolean {
  return typeof Word !== "undefined";
}

async function bootstrap() {
  await ensureOfficeReady();

  if (!container) return;

  const root = createRoot(container);
  root.render(<App showBrowserPreviewHint={!isWordHost()} />);
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap taskpane", err);
  if (container) {
    container.innerHTML =
      '<div style="padding:16px;font-family:Segoe UI,system-ui,sans-serif;line-height:1.6;color:#1f2937">' +
      "<strong>页面加载失败</strong><p>请在 Word 中通过「开始 → AI编辑助手」打开侧栏。</p>" +
      `<p style="color:#6b7280;font-size:12px">${String(err instanceof Error ? err.message : err)}</p>` +
      "</div>";
  }
});
