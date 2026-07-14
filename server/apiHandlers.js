const PROXY_VERSION = 5;

const PROVIDER_ENDPOINTS = {
  deepseek: "https://api.deepseek.com/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
};

function normalizeApiBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "");
}

function resolveEndpoint(provider, apiBaseUrl) {
  if (provider === "custom") {
    const base = normalizeApiBaseUrl(apiBaseUrl);
    if (!base) return null;
    return `${base}/chat/completions`;
  }
  return PROVIDER_ENDPOINTS[provider] || null;
}

async function handleHealth(_req, res) {
  res.status(200).json({
    status: "ok",
    version: PROXY_VERSION,
    supportsCustomProvider: true,
    supportsWebSearch: true,
    supportsDocumentParse: true,
    supportsLatexConvert: true,
  });
}

async function handleChat(req, res) {
  const { getRequestBody } = require("./vercelUtils");
  const { provider, model, messages, apiBaseUrl } = getRequestBody(req);
  const apiKey = req.headers["x-api-key"];

  if (!provider || !model || !messages) {
    return res.status(400).json({ error: "缺少必要参数: provider, model, messages" });
  }

  if (!apiKey) {
    return res.status(401).json({ error: "未提供 API Key，请在设置中配置" });
  }

  const endpoint = resolveEndpoint(provider, apiBaseUrl);
  if (!endpoint) {
    return res.status(400).json({ error: `不支持的 Provider 或缺少 API Base URL: ${provider}` });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg =
      data?.error?.message ||
      data?.message ||
      data?.code ||
      `API 请求失败 (${response.status})`;
    return res.status(response.status).json({ error: errMsg });
  }

  const content = data.choices?.[0]?.message?.content || "";
  return res.json({ content });
}

async function handleWebSearch(req, res) {
  const { getRequestBody } = require("./vercelUtils");
  const { provider, query, maxResults, excludeDomains } = getRequestBody(req);
  const apiKey = req.headers["x-api-key"];

  if (!query || !String(query).trim()) {
    return res.status(400).json({ error: "缺少搜索关键词" });
  }

  if (!apiKey) {
    return res.status(401).json({ error: "未提供 Tavily API Key，请在设置中配置" });
  }

  if (provider && provider !== "tavily") {
    return res.status(400).json({ error: `不支持的搜索引擎: ${provider}` });
  }

  const limit = Math.min(20, Math.max(1, Number(maxResults) || 8));
  const excludes = Array.isArray(excludeDomains)
    ? excludeDomains.map((item) => String(item).trim()).filter(Boolean)
    : [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: String(query).trim(),
        search_depth: "basic",
        max_results: limit,
        exclude_domains: excludes,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    return res.status(502).json({ error: "Tavily 返回了无效数据，请稍后重试" });
  }

  if (!response.ok) {
    const errMsg = data?.error || data?.message || `搜索 API 请求失败 (${response.status})`;
    return res.status(response.status).json({ error: errMsg });
  }

  const results = (data.results || []).map((item) => ({
    title: item.title || "无标题",
    url: item.url || "",
    content: item.content || "",
  }));

  return res.json({ results });
}

async function handleParseDocument(req, res) {
  const { getRequestBody } = require("./vercelUtils");
  const { fileName, mimeType, dataBase64 } = getRequestBody(req);

  if (!dataBase64) {
    return res.status(400).json({ error: "缺少文档数据" });
  }

  let buffer;
  try {
    buffer = Buffer.from(String(dataBase64), "base64");
  } catch {
    return res.status(400).json({ error: "文档数据格式无效" });
  }

  if (!buffer.length) {
    return res.status(400).json({ error: "文档内容为空" });
  }

  const name = String(fileName || "").toLowerCase();
  const type = String(mimeType || "").toLowerCase();
  const isPdf = type.includes("pdf") || name.endsWith(".pdf");
  const isDocx =
    type.includes("wordprocessingml") ||
    type.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc");

  let text = "";

  if (isDocx) {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || "";
  } else if (isPdf) {
    ensurePdfPolyfills();
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    text = result.text || "";
  } else {
    return res.status(400).json({
      error: "不支持的文档格式，请上传 .docx、.doc 或 .pdf，或使用 .txt/.md 等文本文件",
    });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return res.status(422).json({ error: "未能从文档中提取到文本内容" });
  }

  return res.json({ text: trimmed.slice(0, 120000) });
}

module.exports = {
  PROXY_VERSION,
  handleHealth,
  handleChat,
  handleWebSearch,
  handleParseDocument,
};

function ensurePdfPolyfills() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor() {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
      }
      multiplySelf() {
        return this;
      }
      preMultiplySelf() {
        return this;
      }
      translateSelf() {
        return this;
      }
      scaleSelf() {
        return this;
      }
      rotateSelf() {
        return this;
      }
      invertSelf() {
        return this;
      }
      transformPoint(point) {
        return point;
      }
    };
  }

  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData {};
  }

  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2D {};
  }
}
