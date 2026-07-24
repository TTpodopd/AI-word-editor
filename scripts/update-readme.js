#!/usr/bin/env node
/**
 * 更新 README.md 的「更新记录」区块（最后更新日期 + 最近提交摘要，均为中文）。
 * 由 git pre-commit 钩子或 npm run update-readme 调用。
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const README_PATH = path.join(ROOT, "README.md");
const ZH_MAP_PATH = path.join(__dirname, "commit-message-zh.json");
const CHANGELOG_END = "<!-- AUTO:CHANGELOG_END -->";
const MAX_COMMITS = 8;
const HAS_CHINESE = /[\u4e00-\u9fff]/;

function runGit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    return "";
  }
  return (result.stdout || "").trim();
}

function loadZhMap() {
  if (!fs.existsSync(ZH_MAP_PATH)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(ZH_MAP_PATH, "utf8"));
  } catch (err) {
    console.warn("无法读取 commit-message-zh.json:", err.message);
    return {};
  }
}

function resolveCommitLabel(subject, hash, zhMap) {
  const shortHash = hash.slice(0, 7);
  const mapped = zhMap[shortHash] || zhMap[hash];
  if (mapped) {
    return mapped;
  }
  if (HAS_CHINESE.test(subject)) {
    return subject.replace(/\s+$/, "");
  }
  console.warn(
    `[update-readme] 提交 ${shortHash} 无中文说明，请在 scripts/commit-message-zh.json 中补充：`,
    subject
  );
  return subject.replace(/\s+$/, "");
}

function getRecentCommits() {
  const zhMap = loadZhMap();
  const log = runGit(["log", `-${MAX_COMMITS}`, "--pretty=format:%s%x09%h"]);
  if (!log) {
    return ["- （暂无 git 历史）"];
  }
  return log.split("\n").map((line) => {
    const tab = line.lastIndexOf("\t");
    if (tab < 0) return `- ${line}`;
    const subject = line.slice(0, tab);
    const hash = line.slice(tab + 1);
    const label = resolveCommitLabel(subject, hash, zhMap);
    return `- ${label}（${hash.slice(0, 7)}）`;
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
