const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const manifestPath = path.join(projectRoot, "manifest.xml");

function run(cmd, label) {
  console.log(`\n>> ${label}`);
  try {
    execSync(cmd, { cwd: projectRoot, stdio: "inherit", shell: true });
    console.log("   OK");
  } catch {
    console.warn(`   警告: ${label} 失败，继续执行...`);
  }
}

console.log("=== 注册插件到 Word（不中断 dev-server）===");

run("node scripts/generate-icons.js", "生成插件图标");

run("node scripts/verify-icons.js", "检查图标 URL 可访问性");

run("npx office-addin-dev-certs install", "安装/更新开发 HTTPS 证书");

if (process.platform === "win32") {
  const certPath = path.join(
    process.env.USERPROFILE || "",
    ".office-addin-dev-certs",
    "localhost.crt"
  );
  if (certPath && require("fs").existsSync(certPath)) {
    run(
      `powershell -NoProfile -Command "try { Import-Certificate -FilePath '${certPath.replace(/'/g, "''")}' -CertStoreLocation Cert:\\LocalMachine\\Root | Out-Null; Write-Host '证书已导入 LocalMachine\\\\Root' } catch { Write-Host '提示: 请以管理员运行 npm run fix-icons 导入证书' }"`,
      "导入开发证书到系统受信任根（修复 Ribbon 图标）"
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

run(
  `npx office-addin-dev-settings register "${manifestPath}"`,
  "注册插件 manifest 到 Word"
);

run(
  "npx office-addin-dev-settings sideload manifest.xml desktop --app Word",
  "Sideload 到 Word 桌面版（需在 npm start 运行后执行）"
);

run("npx office-addin-manifest validate manifest.xml", "校验 manifest");

console.log("\n=== 完成 ===");
console.log("请保持 npm start 终端继续运行，然后:");
console.log("1. 完全关闭 Word（含后台进程）");
console.log("2. 若图标仍空白，以管理员运行: npm run install-certs");
console.log("3. 删除缓存: %LOCALAPPDATA%\\Microsoft\\Office\\16.0\\Wef\\");
console.log("4. 重新打开 Word\n");
