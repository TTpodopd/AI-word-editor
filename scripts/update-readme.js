#!/usr/bin/env node
/**
 * 更新 README.md 的「更新记录」区块（最后更新日期 + 最近提交摘要）。
 * 由 git pre-commit 钩子或 npm run update-readme 调用。
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const README_PATH = path.join(ROOT, "README.md");
const CHANGELOG_END = "<!-- AUTO:CHANGELOG_END -->";
const MAX_COMMITS = 8;

function runGit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    return "";
  }
  return (result.stdout || "").trim();
}

function getRecentCommits() {
  const log = runGit(["log", `-${MAX_COMMITS}`, "--pretty=format:%s%x09%h"]);
  if (!log) {
    return ["- （暂无 git 历史）"];
  }
  return log.split("\n").map((line) => {
    const tab = line.lastIndexOf("\t");
    if (tab < 0) return `- ${line}`;
    const subject = line.slice(0, tab);
    const hash = line.slice(tab + 1);
    return `- ${subject} (${hash})`;
  });
}

function buildChangelogSection() {
  const today = new Date().toISOString().slice(0, 10);
  const lines = getRecentCommits();

  return [
    "## 更新记录",
    "",
    `> 最后更新：${today}`,
    "",
    ...lines,
    "",
    CHANGELOG_END,
  ].join("\n");
}

function updateReadme() {
  if (!fs.existsSync(README_PATH)) {
    console.error("README.md not found");
    process.exit(1);
  }

  const readme = fs.readFileSync(README_PATH, "utf8");
  const pattern = new RegExp(
    `## 更新记录[\\s\\S]*?${CHANGELOG_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  );

  if (!pattern.test(readme)) {
    console.error('README.md 缺少「## 更新记录」或 AUTO:CHANGELOG_END 标记');
    process.exit(1);
  }

  const next = readme.replace(pattern, buildChangelogSection());
  if (next === readme) {
    console.log("README 更新记录已是最新");
    return;
  }

  fs.writeFileSync(README_PATH, next, "utf8");
  console.log("README 更新记录已刷新");
}

updateReadme();
