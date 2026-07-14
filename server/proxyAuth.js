function getRequiredToken() {
  return String(process.env.PROXY_ACCESS_TOKEN || "").trim();
}

function proxyAccessMiddleware(req, res, next) {
  const required = getRequiredToken();
  if (!required) {
    return next();
  }

  if (req.method === "OPTIONS") {
    return next();
  }

  if (req.path === "/api/health") {
    return next();
  }

  const provided = String(req.headers["x-proxy-access-token"] || "").trim();
  if (provided && provided === required) {
    return next();
  }

  return res.status(401).json({ error: "无效的代理访问令牌，请在插件设置中填写正确令牌" });
}

module.exports = { proxyAccessMiddleware };
