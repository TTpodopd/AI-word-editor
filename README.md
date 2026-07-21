# AI编辑助手

Word AI 编辑助手插件：在侧栏中完成智能编辑、多轮对话、联网搜索与表单填充，支持多模型与预览确认后再写入文档。

## 功能概览

### 文本编辑

- **选区快捷操作**：汇总、精简、扩写、润色、校对、翻译
- **预览后确认**：默认先展示修改预览（Diff 高亮），点击「确定替换」再写入 Word
- **快捷直接写入**：设置中可开启「快捷操作直接写入文档」，跳过预览
- **斜杠指令**：`/汇总`、`/精简`、`/扩写`、`/润色`、`/校对`、`/翻译`、`/填表`
- **格式自适应清理**：写入 Word 时自动去除 `**`、`【】` 等 AI 常见 Markdown 标记（参照原文风格）

### 对话与上下文

- **多轮对话**：支持无选区时的自由问答与内容生成
- **流式输出**：AI 回复逐字显示，生成中可点击「停止」
- **历史会话**：最多 50 个会话，支持重命名、拖拽排序、删除
- **会话导出 / 导入**：导出 JSON 备份，支持合并导入（换机、分享 prompt）
- **上下文用量**：输入框底部固定显示 `用量 / 200k tok` 与进度条，每次对话后刷新
- **历史自动裁剪**：上下文超过预算时自动省略最早的消息，并 toast 提示

### 模型与设置

- **内置模型**：DeepSeek R1 / Chat、GPT-4o / Mini、通义千问 Plus / Turbo
- **自定义 Provider**：支持 OpenAI 兼容第三方 API（自定义 Base URL 与模型列表）
- **模型显示控制**：可隐藏不需要的模型
- **系统提示词**：分别配置「有选区 / 无选区」场景，支持首行缩进规则
- **主题颜色**：多种预设主题色

### 附件与扩展能力

- **上传附件**：图片（视觉模型）、PDF / Word / 文本文件
- **引用 Word 内容**：一键引用当前选区或全文作为附件
- **LaTeX 公式**：插入或替换选区为 Word 公式
- **联网搜索**（Tavily）：开启后在对话中检索实时信息，助手回复上方展示来源标题与可点击链接
- **智能填表**（`/填表`）：针对 Word 表单区域扫描字段，AI 生成 JSON 后预览并填充（偏科技申报场景）

### 代理与安全

- 开发环境：`webpack :3000` + 本地代理 `:3001`，API Key 经代理转发
- 可选 `PROXY_ACCESS_TOKEN` / 设置中的代理访问令牌，防止代理被滥用
- 联网搜索、文档解析、LaTeX 转换等均由同一代理提供

## 环境要求

- Node.js 18+
- Microsoft Word 2016+ 或 Microsoft 365（桌面版）
- 各 LLM 平台的 API Key（联网搜索需 Tavily API Key）

## 快速开始

详细安装步骤请参阅 **[Word 插件安装添加指南](docs/Word插件安装添加指南.md)**，涵盖开发调试、手动旁加载、团队部署及常见问题。

```bash
# 安装依赖
npm install

# 首次使用：注册 manifest、配置权限（只需一次）
npm run setup

# 启动开发服务（日常开发可加 FAST_START=1 跳过端口检测）
npm start
```

启动后终端应出现 `webpack compiled successfully` 与代理服务日志。Word 通过旁加载方式加载插件。

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 开发模式（Web + 代理） |
| `npm run build` | 生产构建 |
| `npm run start:prod` | 本地 HTTPS 一体服务（静态 + API） |
| `npm run sideload` | 旁加载到 Word |
| `npm run validate` | 校验 manifest |
| `npm run install:local` | 生成本地安装包 |

## 配置

1. 在 Word 中打开「AI编辑助手」侧栏
2. 点击底部 **设置**
3. 配置官方 API Key（DeepSeek / OpenAI / 通义千问）或 **OpenAI 兼容第三方 API**
4. （可选）配置 Tavily Key、系统提示词、快捷直接写入、主题色
5. 保存并测试连接

## 使用方式

### 选区编辑（推荐流程）

1. 在 Word 中选中要处理的文本
2. 侧栏顶部出现快捷按钮，或输入 `/校对` 等指令
3. 查看 AI 修改预览（绿色高亮为改动）
4. 点击 **确定替换** 写回文档

### 自由对话

1. 在底部输入框输入问题或指令
2. 可选：开启联网搜索、上传附件、引用 Word 选区/全文
3. 查看流式回复；需要插入文档时点击 **插入到文档**

### 会话备份

1. 点击底部 **历史会话**（日历图标）
2. **导出 JSON** 备份全部会话
3. **导入合并** 从 JSON 恢复或合并到其他机器

## 项目结构

```
├── manifest.xml              # Office 插件清单
├── server/
│   ├── index.js              # 开发代理入口 (:3001)
│   ├── createApiApp.js       # Express API（chat / 搜索 / 文档 / LaTeX）
│   ├── llmChatHandler.js     # LLM 代理（流式 SSE、错误提示）
│   └── standalone.js         # 生产一体 HTTPS 服务
├── api/                      # Vercel Serverless 适配
├── src/taskpane/             # React 侧栏 UI
│   ├── App.tsx               # 主布局与路由
│   ├── hooks/                # useChat、useSelection 等
│   ├── components/           # 对话、输入、设置、会话切换等
│   ├── services/             # Word API、LLM、存储、填表、附件
│   ├── prompts/              # 预设指令与填表 Prompt
│   └── utils/                # 文本格式、上下文预算、Diff 等
├── docs/                     # 安装与部署文档
└── assets/                   # 图标资源
```

## 构建与部署

```bash
npm run build
npm run start:prod   # 本地验证生产包
```

云端部署可参考仓库内 Vercel 相关配置与 `docs/` 中的部署说明。

## 注意事项

- Office.js 不支持选区旁浮动菜单，操作通过侧栏实现
- API Key 经本地或自建代理传输，请勿将含 Key 的配置提交到公开仓库
- 选区在编辑流程中通过 `range.track()` 保持；若选区失效，请重新选中后再应用
- 修改 `server/` 代理代码后需 **重启 `npm start`** 才能生效
- 上下文预算默认 **200k tokens**（约 40 万字符估算），可在 `src/taskpane/utils/chatHistoryBudget.ts` 中调整

## 相关文档

- [Word 插件安装添加指南](docs/Word插件安装添加指南.md)
