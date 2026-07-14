function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Proxy-Access-Token");
}

function getRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function isProxyAuthorized(req) {
  const required = String(process.env.PROXY_ACCESS_TOKEN || "").trim();
  if (!required) return true;
  const provided = String(req.headers["x-proxy-access-token"] || "").trim();
  return provided === required;
}

function sendUnauthorized(res) {
  setCorsHeaders(res);
  res.status(401).json({ error: "无效的代理访问令牌，请在插件设置中填写正确令牌" });
}

function withApiHandler(handler, options = {}) {
  const { requireAuth = true } = options;

  return async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (requireAuth && !isProxyAuthorized(req)) {
      sendUnauthorized(res);
      return;
    }

    try {
      await handler(req, res);
    } catch (err) {
      console.error("API handler error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "服务器内部错误",
      });
    }
  };
}

module.exports = {
  setCorsHeaders,
  getRequestBody,
  withApiHandler,
};
