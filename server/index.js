const { createApiApp, PROXY_VERSION } = require("./createApiApp");

const PORT = process.env.PROXY_PORT || 3001;

function startServer(port) {
  const app = createApiApp();
  const server = app.listen(port, () => {
    console.log(`[proxy] http://localhost:${port} (v${PROXY_VERSION})`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[proxy] 端口 ${port} 被占用，请先停止其他 npm start`);
      process.exit(1);
    }

    console.error("[proxy] 启动失败:", err);
    process.exit(1);
  });
}

if (require.main === module) {
  startServer(Number(PORT));
}

module.exports = { createApiApp, PROXY_VERSION };
