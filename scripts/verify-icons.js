const https = require("https");
const fs = require("fs");
const path = require("path");

const ICONS = ["icon-16.png", "icon-32.png", "icon-64.png", "icon-80.png", "icon-128.png"];
const BASE_URL = process.env.ICON_BASE_URL || "https://localhost:3000/assets";

function fetchIcon(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          url,
          status: res.statusCode,
          type: res.headers["content-type"],
          bytes: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

async function main() {
  console.log("=== 检查 Ribbon 图标是否可访问 ===\n");
  console.log(`目标服务: ${BASE_URL}\n`);

  let ok = true;

  for (const name of ICONS) {
    const url = `${BASE_URL}/${name}`;
    try {
      const result = await fetchIcon(url);
      const isPng = result.bytes.slice(0, 4).toString("hex") === "89504e47";
      const pass = result.status === 200 && isPng;
      console.log(`${pass ? "OK" : "FAIL"} ${name}`);
      console.log(`     ${url}`);
      console.log(`     status=${result.status} type=${result.type} bytes=${result.bytes.length}`);
      if (!pass) ok = false;
    } catch (err) {
      ok = false;
      console.log(`FAIL ${name}`);
      console.log(`     ${url}`);
      console.log(`     error=${err.message}`);
    }
  }

  const localDir = path.join(__dirname, "..", "assets");
  console.log("\n本地文件:");
  for (const name of ICONS) {
    const file = path.join(localDir, name);
    if (fs.existsSync(file)) {
      console.log(`OK   assets/${name} (${fs.statSync(file).size} bytes)`);
    } else {
      console.log(`FAIL assets/${name} 不存在`);
      ok = false;
    }
  }

  console.log("\n若 FAIL，请先执行: npm start");
  console.log("若本地 OK 但 Ribbon 仍空白，请以管理员运行:");
  console.log("  npx office-addin-dev-certs install --machine");
  console.log("然后关闭 Word，删除缓存目录后重开:");
  console.log("  %LOCALAPPDATA%\\Microsoft\\Office\\16.0\\Wef\\");
  console.log("");

  process.exit(ok ? 0 : 1);
}

main();
