const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const distManifest = path.join(projectRoot, "dist", "manifest.xml");
const rootManifest = path.join(projectRoot, "manifest.xml");
const manifestPath = fs.existsSync(distManifest) ? distManifest : rootManifest;

function run(cmd, label) {
  console.log(`\n>> ${label}`);
  try {
    execSync(cmd, { cwd: projectRoot, stdio: "inherit", shell: true });
    console.log("   OK");
    return true;
  } catch {
    console.warn(`   警告: ${label} 失败`);
    return false;
  }
}

console.log("=== 单机安装：注册 AI编辑助手 到 Word ===");

if (!fs.existsSync(manifestPath)) {
  console.error("未找到 manifest.xml，请先执行 npm run build");
  process.exit(1);
}

run("node scripts/generate-icons.js", "生成插件图标");
run("npx office-addin-dev-certs install", "安装/更新本机 HTTPS 证书");

if (process.platform === "win32") {
  const certPath = path.join(
    process.env.USERPROFILE || "",
    ".office-addin-dev-certs",
    "localhost.crt"
  );
  if (certPath && fs.existsSync(certPath)) {
    run(
      `powershell -NoProfile -Command "try { Import-Certificate -FilePath '${certPath.replace(/'/g, "''")}' -CertStoreLocation Cert:\\LocalMachine\\Root | Out-Null; Write-Host '证书已导入 LocalMachine\\\\Root' } catch { Write-Host '提示: 请以管理员身份运行以导入证书到系统根证书' }"`,
      "导入开发证书到系统受信任根（修复图标空白）"
    );
  }
}

run(
  "npx office-addin-dev-settings appcontainer EdgeWebView --loopback --yes",
  "配置 Edge WebView localhost 回环权限"
);
run(
  `npx office-addin-dev-settings appcontainer "${manifestPath}" --loopback --yes`,
  "配置插件 AppContainer localhost 回环权限"
);
run(`npx office-addin-dev-settings register "${manifestPath}"`, "注册 manifest 到 Word");
run(`npx office-addin-manifest validate "${manifestPath}"`, "校验 manifest");

console.log("\n=== 注册完成 ===");
console.log("接下来请:");
console.log("1. 启动生产服务: npm run start:prod");
console.log("2. 完全关闭 Word（含后台进程）后重新打开");
console.log("3. 在 Word 中: 插入 → 我的加载项 → 上传我的加载项");
console.log(`4. 选择文件: ${manifestPath}`);
console.log("5. 打开 Word「开始」选项卡，点击「AI编辑助手」按钮\n");
