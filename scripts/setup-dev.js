const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const manifestPath = path.join(projectRoot, "manifest.xml");
const verbose = process.argv.includes("--verbose");

function run(cmd, label) {
  if (verbose) {
    console.log(`>> ${label}`);
  }
  try {
    execSync(cmd, {
      cwd: projectRoot,
      stdio: verbose ? "inherit" : "pipe",
      shell: true,
    });
    if (verbose) console.log("   OK");
    return true;
  } catch {
    console.warn(`[setup] 跳过: ${label}`);
    return false;
  }
}

console.log("[setup] 初始化开发环境…");

run("node scripts/generate-icons.js", "生成插件图标");
run("node scripts/setup-git-hooks.js", "配置 git hooks（commit 前更新 README）");

const { freePorts } = require("./utils/ports");
freePorts([3000, 3001], { quiet: !verbose });

run(
  "npx office-addin-dev-settings appcontainer EdgeWebView --loopback --yes",
  "Edge WebView 回环权限"
);
run(
  `npx office-addin-dev-settings appcontainer "${manifestPath}" --loopback --yes`,
  "插件 AppContainer 回环权限"
);
run(`npx office-addin-dev-settings register "${manifestPath}"`, "注册 manifest");
run("npx office-addin-manifest validate manifest.xml", "校验 manifest");

console.log("[setup] 完成。运行 npm start 启动开发服务。");
