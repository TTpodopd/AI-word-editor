const fs = require("fs");
const path = require("path");
const https = require("https");
const devCerts = require("office-addin-dev-certs");
const { createApiApp, PROXY_VERSION } = require("./createApiApp");

const PORT = Number(process.env.WEB_PORT || 3000);
const DIST_DIR = path.join(__dirname, "..", "dist");

async function startStandaloneServer() {
  const taskpanePath = path.join(DIST_DIR, "taskpane.html");
  if (!fs.existsSync(taskpanePath)) {
    console.error("[prod] 未找到 dist/taskpane.html，请先执行: npm run build");
    process.exit(1);
  }

  const app = createApiApp();
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });
  app.use(
    require("express").static(DIST_DIR, {
      index: false,
      maxAge: "1h",
    })
  );

  const httpsOptions = await devCerts.getHttpsServerOptions();
  const server = https.createServer(httpsOptions, app);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[prod] 端口 ${PORT} 被占用，请关闭 npm start 或其他占用进程`);
      process.exit(1);
    }
    console.error("[prod] 启动失败:", err);
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`[prod] https://localhost:${PORT} (v${PROXY_VERSION})`);
    console.log("[prod] 单机生产服务已启动（静态页面 + API 代理）");
    console.log("[prod] 保持此窗口运行，或在后台注册为开机自启服务");
  });
}

if (require.main === module) {
  startStandaloneServer().catch((err) => {
    console.error("[prod] 启动失败:", err);
    process.exit(1);
  });
}

module.exports = { startStandaloneServer };
