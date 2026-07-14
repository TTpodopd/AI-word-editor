const fs = require("fs");
const path = require("path");

const assetsDir = path.join(__dirname, "..", "assets");
const svgPath = path.join(assetsDir, "icon.svg");
const BRAND_BG = { r: 91, g: 77, b: 199, alpha: 1 };

const SIZES = [
  { name: "icon-16.png", size: 16 },
  { name: "icon-32.png", size: 32 },
  { name: "icon-64.png", size: 64 },
  { name: "icon-80.png", size: 80 },
  { name: "icon-128.png", size: 128 },
];

async function generateWithSharp() {
  const sharp = require("sharp");
  const svg = fs.readFileSync(svgPath);

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  for (const { name, size } of SIZES) {
    await sharp(svg, { density: 384 })
      .resize(size, size, {
        fit: "fill",
        background: BRAND_BG,
      })
      .png({
        compressionLevel: 6,
        force: true,
      })
      .withMetadata({ density: 96 })
      .toFile(path.join(assetsDir, name));
  }
}

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error("Missing assets/icon.svg");
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  const allExist = SIZES.every(({ name }) => fs.existsSync(path.join(assetsDir, name)));
  const svgMtime = fs.statSync(svgPath).mtimeMs;
  const upToDate =
    allExist &&
    SIZES.every(({ name }) => fs.statSync(path.join(assetsDir, name)).mtimeMs >= svgMtime);

  if (!force && upToDate) {
    return;
  }

  try {
    await generateWithSharp();
    console.log("[icons] 已生成 PNG 图标");
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.error("请先安装 sharp: npm install --save-dev sharp");
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
