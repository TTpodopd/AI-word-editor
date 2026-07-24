#!/usr/bin/env node
/**
 * 将 git hooks 路径指向仓库内 .githooks（pre-commit 会自动更新 README）。
 */
const { execSync } = require("child_process");
const path = require("path");

const hooksPath = path.join(__dirname, "..", ".githooks");

try {
  execSync(`git config core.hooksPath "${hooksPath.replace(/\\/g, "/")}"`, {
    stdio: "inherit",
  });
  console.log("Git hooks 已配置：.githooks/pre-commit 会在每次 commit 前更新 README");
} catch (err) {
  console.warn("无法配置 git hooks（可能不在 git 仓库中）:", err.message);
}
