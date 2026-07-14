const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".office-addin-dev-certs",
]);

const IGNORED_FILES = new Set([
  ".env.example",
  "package-lock.json",
]);

const SENSITIVE_PATTERNS = [
  { name: "OpenAI API Key", regex: /sk-[A-Za-z0-9]{20,}/ },
  { name: "DeepSeek / Generic API Key", regex: /sk-[A-Za-z0-9_-]{16,}/ },
  { name: "Bearer Token", regex: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
  { name: "Tavily API Key", regex: /tvly-[A-Za-z0-9]{16,}/ },
  { name: "Hardcoded env assignment", regex: /(api[_-]?key|secret|token)\s*[:=]\s*["'][^"'\s]{12,}["']/i },
];

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".xml",
  ".html",
  ".css",
  ".yml",
  ".yaml",
  ".env",
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".env") && entry.name !== ".env.example") {
      files.push(path.join(dir, entry.name));
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(fullPath, files);
      continue;
    }

    if (IGNORED_FILES.has(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext) && !filePath.endsWith(".env")) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const hits = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) return;
    if (trimmed.includes("placeholder") || trimmed.includes("请替换")) return;
    if (trimmed.includes("example") || trimmed.includes("YOUR_")) return;

    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.regex.test(line)) {
        hits.push({
          file: path.relative(ROOT, filePath),
          line: index + 1,
          rule: pattern.name,
          preview: trimmed.slice(0, 120),
        });
      }
    }
  });

  return hits;
}

function main() {
  console.log("=== 推送前密钥安全检查 ===");

  const envFiles = [".env", ".env.local", ".env.production"].filter((name) =>
    fs.existsSync(path.join(ROOT, name))
  );

  if (envFiles.length > 0) {
    console.error("\n发现本地环境变量文件（不应提交到 Git）：");
    envFiles.forEach((name) => console.error(`  - ${name}`));
    console.error("\n请确认 .gitignore 已忽略这些文件，且 git add 时不要包含它们。\n");
  }

  const files = walk(ROOT);
  const findings = files.flatMap(scanFile);

  if (findings.length > 0) {
    console.error("\n疑似敏感信息：");
    findings.forEach((item) => {
      console.error(`  [${item.rule}] ${item.file}:${item.line}`);
      console.error(`    ${item.preview}`);
    });
    console.error("\n请移除或替换上述内容后再推送到 GitHub。\n");
    process.exit(1);
  }

  console.log("未发现疑似 API Key / Token 泄露。");
  console.log("提醒：LLM API Key 应只保存在 Word 插件设置中，代理令牌放在 Vercel 环境变量。\n");
}

main();
