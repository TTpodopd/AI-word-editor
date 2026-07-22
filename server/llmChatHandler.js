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

function getEndpointHost(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return String(endpoint || "unknown");
  }
}

function describeFetchError(err) {
  if (!(err instanceof Error)) {
    return "代理服务内部错误";
  }

  const cause = err.cause;
  const causeCode = cause && typeof cause === "object" ? cause.code : "";
  const causeMessage =
    cause instanceof Error ? cause.message : cause ? String(cause) : "";

  if (err.name === "AbortError") {
    return "请求已取消";
  }

  if (causeCode === "UND_ERR_SOCKET" || /other side closed/i.test(causeMessage)) {
    return "无法连接模型服务，请检查 API Key、Base URL 与网络";
  }

  if (causeCode === "ECONNREFUSED") {
    return "无法连接模型服务，目标地址拒绝连接，请检查 Base URL";
  }

  if (causeCode === "ENOTFOUND") {
    return "无法解析模型服务地址，请检查 Base URL 是否正确";
  }

  if (causeCode === "ETIMEDOUT" || causeCode === "UND_ERR_CONNECT_TIMEOUT") {
    return "连接模型服务超时，请检查网络连接后重试";
  }

  if (/fetch failed/i.test(err.message)) {
    return "无法连接模型服务，请检查 API Key、Base URL 与网络";
  }

  return err.message || "代理服务内部错误";
}

function logLlmProxyError({ provider, model, endpoint, err }) {
  const host = getEndpointHost(endpoint);
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause : null;
  const causeDetail = cause ? ` cause=${cause.code || cause.message}` : "";
  console.error(
    `[proxy] LLM proxy error: provider=${provider} host=${host} model=${model}${causeDetail}`,
    err
  );
}

async function readUpstreamError(response) {
  const rawText = await response.text();
  if (!rawText) {
    return `API 请求失败 (${response.status})`;
  }

  try {
    const data = JSON.parse(rawText);
    return (
      data?.error?.message ||
      data?.message ||
      data?.code ||
      `API 请求失败 (${response.status})`
    );
  } catch {
    return rawText.slice(0, 200) || `API 请求失败 (${response.status})`;
  }
}

async function pipeUpstreamStream(upstream, res) {
  if (!upstream.body) {
    res.write(`data: ${JSON.stringify({ error: "上游未返回流式数据" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (!payload) continue;

      if (payload === "[DONE]") {
        res.write("data: [DONE]\n\n");
        continue;
      }

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice(5).trim();
      if (payload && payload !== "[DONE]") {
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
}

const UPSTREAM_TIMEOUT_MS = 120000;

function attachClientAbortHandler(req, res, abort) {
  const maybeAbort = () => {
    if (res.writableEnded || res.writableFinished) return;
    abort();
  };

  res.on("close", maybeAbort);
  req.on("aborted", maybeAbort);
}

async function executeLlmChat(body, headers, res, options = {}) {
  const { provider, model, messages, apiBaseUrl, stream } = body || {};
  const apiKey = headers["x-api-key"];
  const onClientClose = options.onClientClose;

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

  const host = getEndpointHost(endpoint);
  console.log(
    `[proxy] LLM request: provider=${provider} host=${host} model=${model} stream=${!!stream}`
  );

  const controller = new AbortController();
  const upstreamTimeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  if (typeof onClientClose === "function") {
    onClientClose(() => controller.abort());
  }

  try {
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
        stream: !!stream,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errMsg = await readUpstreamError(response);
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      return res.status(response.status).json({ error: errMsg });
    }

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      await pipeUpstreamStream(response, res);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return res.json({ content });
  } catch (err) {
    logLlmProxyError({ provider, model, endpoint, err });
    const message = describeFetchError(err);

    if (stream && !res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
    }

    if (stream) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    return res.status(500).json({ error: message });
  } finally {
    clearTimeout(upstreamTimeout);
  }
}

function handleLlmChatRoute(req, res) {
  return executeLlmChat(req.body, req.headers, res, {
    onClientClose: (abort) => {
      attachClientAbortHandler(req, res, abort);
    },
  });
}

module.exports = {
  executeLlmChat,
  handleLlmChatRoute,
  describeFetchError,
};
