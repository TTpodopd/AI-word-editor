# AI编辑助手

Word AI 编辑助手插件，支持选中文本后进行汇总、精简、扩写、润色、翻译等智能操作。

## 功能

- 选中文本后自动显示快捷操作按钮
- 支持 DeepSeek、OpenAI、通义千问多模型切换
- AI 结果预览后确认应用，避免误改
- 斜杠指令（`/汇总`、`/精简`、`/扩写` 等）
- API Key 本地存储，经本地代理转发

## 环境要求

- Node.js 18+
- Microsoft Word 2016+ 或 Microsoft 365（桌面版）
- 各 LLM 平台的 API Key

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

首次运行会自动安装 HTTPS 开发证书。Word 会通过旁加载方式加载插件。

## 配置 API Key

1. 在 Word 中打开「AI编辑助手」侧栏
2. 点击右上角设置按钮
3. 输入各平台的 API Key 并测试连接
4. 保存设置

## 使用方式

1. 在 Word 文档中选中要处理的文本
2. 侧栏自动显示操作按钮（汇总、精简、扩写等）
3. 点击操作后等待 AI 处理
4. 预览结果，点击「应用」写回文档

也可在底部输入框输入自定义指令，或使用 `/` 唤起预设指令。

## 项目结构

```
├── manifest.xml          # Office 插件清单
├── server/index.js       # LLM API 本地代理
├── src/taskpane/         # React 侧栏 UI
│   ├── components/       # UI 组件
│   ├── hooks/            # 选区监听、对话逻辑
│   ├── services/         # Word API、LLM、存储
│   └── prompts/          # 操作 Prompt 模板
└── assets/               # 图标资源
```

## 构建

```bash
npm run build
```

## 注意事项

- Office.js 不支持选区旁浮动菜单，操作通过侧栏实现
- API Key 经本地代理传输，适合个人/小团队本机使用
- 选区在 AI 处理期间通过 `range.track()` 保持，若用户修改选区需重新选中
