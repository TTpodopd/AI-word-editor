# Word 插件安装与添加指南

本文档详细说明如何在 Microsoft Word 中安装、添加和使用 **AI编辑助手** 插件，涵盖开发调试、本机旁加载、团队部署及常见问题排查。

---

## 目录

1. [插件简介](#1-插件简介)
2. [环境要求](#2-环境要求)
3. [方式一：开发模式安装（推荐调试）](#3-方式一开发模式安装推荐调试)
4. [方式二：手动旁加载（Windows）](#4-方式二手动旁加载windows)
5. [方式三：共享文件夹旁加载（团队内网）](#5-方式三共享文件夹旁加载团队内网)
6. [方式四：Microsoft 365 集中部署（企业）](#6-方式四microsoft-365-集中部署企业)
7. [首次配置 API Key](#7-首次配置-api-key)
8. [使用说明](#8-使用说明)
9. [生产环境构建与发布](#9-生产环境构建与发布)
10. [卸载与移除插件](#10-卸载与移除插件)
11. [常见问题排查](#11-常见问题排查)
12. [附录](#12-附录)

---

## 1. 插件简介

**AI编辑助手** 是一款基于 Office Add-in 技术的 Word 侧栏插件，主要能力包括：

| 功能 | 说明 |
|------|------|
| 选区智能编辑 | 选中 Word 文本后，侧栏自动显示汇总、精简、扩写、润色、翻译等操作 |
| 多模型支持 | 支持 DeepSeek、OpenAI、通义千问，可在侧栏底部切换 |
| 预览后应用 | AI 生成结果先预览，用户确认后再写回文档，避免误改 |
| 自定义指令 | 底部输入框支持自由对话；输入 `/` 可唤起预设指令 |
| 本地代理 | API Key 保存在本机，请求经本地代理转发，不上传云端 |

插件在 Word 功能区显示为 **「AI编辑助手」** 按钮，点击后打开右侧任务窗格（Task Pane）。

---

## 2. 环境要求

### 2.1 软件要求

| 项目 | 最低要求 | 推荐 |
|------|----------|------|
| 操作系统 | Windows 10 / macOS | Windows 11 |
| Microsoft Word | 2016 或更高版本 | Microsoft 365 桌面版 |
| Node.js | 18.x | 20.x LTS |
| npm | 9.x | 10.x |

> **说明**：本插件基于 Office.js 开发，支持 Word 桌面版（Windows/Mac）和 Word 网页版。开发调试阶段建议使用 **Windows 桌面版 Word**。

### 2.2 网络与 API 要求

- 开发模式：本机需能访问 `https://localhost:3000`（插件 UI）和 `http://localhost:3001`（LLM 代理）
- 使用 AI 功能：需能访问对应大模型 API（DeepSeek / OpenAI / 通义千问）
- 至少配置一个平台的 **API Key**

### 2.3 获取 API Key

| 平台 | 获取地址 | 用途 |
|------|----------|------|
| DeepSeek | https://platform.deepseek.com | 默认模型 DeepSeek R1 |
| OpenAI | https://platform.openai.com | GPT-4o 等模型 |
| 通义千问 | https://dashscope.aliyun.com | 通义千问 Plus/Turbo |

---

## 3. 方式一：开发模式安装（推荐调试）

适用于开发者或需要修改代码、实时预览的场景。该方式会自动完成 HTTPS 证书安装、启动本地服务、并将插件旁加载到 Word。

### 3.1 安装项目依赖

打开终端（PowerShell 或 CMD），进入项目目录：

```powershell
cd "E:\2-AIprogram\2-word插件\AI编辑助手"
npm install
```

首次安装会自动执行 `postinstall` 脚本，在 `assets/` 目录生成插件图标。

### 3.2 启动开发服务

```powershell
npm start
```

该命令会同时启动三个进程：

| 进程 | 端口 | 作用 |
|------|------|------|
| webpack dev server | `https://localhost:3000` | 插件前端页面（HTTPS） |
| LLM 代理服务 | `http://localhost:3001` | 转发大模型 API 请求 |
| office-addin-debugging | — | 自动将 manifest 旁加载到 Word |

### 3.3 首次运行：信任开发证书

首次执行 `npm start` 时，系统可能弹出提示，要求安装本地 HTTPS 开发证书：

1. 若终端提示安装证书，选择 **是 / 允许**
2. 也可手动安装证书：

```powershell
npx office-addin-dev-certs install
```

3. 安装后重启 Word

### 3.4 在 Word 中确认插件已加载

1. 打开 Microsoft Word（建议先完全退出再重新打开）
2. 查看功能区 **「开始」** 选项卡
3. 找到 **「AI编辑助手」** 按钮组
4. 点击 **「AI编辑助手」** 按钮，右侧应出现插件侧栏
5. 侧栏顶部显示红色 **milei** 品牌标识

### 3.5 停止开发服务

在终端按 `Ctrl + C` 停止服务，或执行：

```powershell
npm run stop
```

> **注意**：开发模式下，必须先保持 `npm start` 运行，Word 才能正常加载插件。关闭终端后插件将无法使用。

---

## 4. 方式二：手动旁加载（Windows）

若自动旁加载失败，或希望手动控制加载过程，可按以下步骤操作。

### 4.1 启动本地服务

```powershell
cd "E:\2-AIprogram\2-word插件\AI编辑助手"
npm install
npm start
```

确保 `https://localhost:3000` 可访问（浏览器打开不报错）。

### 4.2 通过 Word 信任中心添加

**Word 2016 / 2019 / 2021：**

1. 打开 Word → **文件** → **选项**
2. 进入 **信任中心** → **信任中心设置**
3. 选择 **受信任的加载项目录**（Trusted Add-in Catalogs）
4. 在「目录 URL」中填入共享目录或本地 manifest 路径
5. 勾选 **「在菜单中显示」**
6. 点击 **确定**，重启 Word

**Microsoft 365：**

1. 打开 Word → **文件** → **选项** → **信任中心** → **信任中心设置**
2. 选择 **受信任的加载项目录**
3. 添加 manifest 所在目录
4. 重启 Word

### 4.3 通过「我的加载项」手动添加

1. 打开 Word
2. 点击 **插入** → **我的加载项** → **上传我的加载项**
3. 选择项目根目录下的 `manifest.xml`
4. 确认上传

### 4.4 通过注册表旁加载（高级）

> 仅建议在自动旁加载失败时使用。

1. 确认 `manifest.xml` 路径，例如：
   ```
   E:\2-AIprogram\2-word插件\AI编辑助手\manifest.xml
   ```

2. 打开注册表编辑器（`regedit`）

3. 导航到：
   ```
   HKEY_CURRENT_USER\Software\Microsoft\Office\16.0\WEF\Developer
   ```
   > Office 版本对应：16.0 = Office 2016/2019/365，15.0 = Office 2013

4. 新建 **字符串值**，名称自定义（如 `AIEditorAssistant`），值为 manifest 完整路径

5. 重启 Word，在 **插入 → 我的加载项 → 开发人员加载项** 中查看

---

## 5. 方式三：共享文件夹旁加载（团队内网）

适用于小团队在同一局域网内共享使用，无需每人单独运行开发服务。

### 5.1 构建生产包

```powershell
npm run build
```

构建产物输出到 `dist/` 目录，包含：

```
dist/
├── taskpane.html
├── taskpane.js
├── commands.html
├── commands.js
├── manifest.xml
└── assets/
```

### 5.2 部署到 Web 服务器

将 `dist/` 目录内容部署到 HTTPS Web 服务器，例如：

```
https://your-server.example.com/ai-editor/
```

### 5.3 修改 manifest 中的 URL

编辑 `dist/manifest.xml`，将所有 `https://localhost:3000` 替换为实际服务器地址：

```xml
<!-- 修改前 -->
<SourceLocation DefaultValue="https://localhost:3000/taskpane.html"/>

<!-- 修改后 -->
<SourceLocation DefaultValue="https://your-server.example.com/ai-editor/taskpane.html"/>
```

同时修改 `AppDomains`、`IconUrl`、`bt:Url` 等所有 localhost 引用。

### 5.4 部署 LLM 代理服务

生产环境仍需运行 LLM 代理（或替换为云端 API 网关）：

```powershell
node server/index.js
```

建议将代理部署为后台服务，并配置前端 `llmService.ts` 中的 API 地址指向生产代理。

### 5.5 配置共享目录

1. 将修改后的 `manifest.xml` 放到网络共享目录，例如：
   ```
   \\fileserver\addons\ai-editor\manifest.xml
   ```

2. 在各用户 Word 中配置 **受信任的加载项目录**，指向该共享路径

3. 用户重启 Word 后即可在 **插入 → 我的加载项** 中看到插件

---

## 6. 方式四：Microsoft 365 集中部署（企业）

适用于企业 IT 管理员统一分发插件。

### 6.1 前置条件

- 组织使用 Microsoft 365 商业版/企业版
- 拥有 **全局管理员** 或 **Exchange 管理员** 权限
- 插件已部署到可公网访问的 HTTPS 服务器

### 6.2 部署步骤

1. 登录 [Microsoft 365 管理中心](https://admin.microsoft.com)
2. 进入 **设置** → **集成应用** → **上传自定义应用**
3. 选择 **提供链接到清单文件**
4. 输入 manifest URL，例如：
   ```
   https://your-server.example.com/ai-editor/manifest.xml
   ```
5. 按向导完成上传与审核
6. 在 **部署** 页面选择目标用户或组
7. 用户下次打开 Word 时，插件将自动出现在功能区

### 6.3 验证部署

1. 以被分配用户身份登录 Word
2. 检查功能区是否出现 **AI编辑助手**
3. 打开侧栏，确认 UI 正常加载
4. 测试选区操作与 API 调用

---

## 7. 首次配置 API Key

插件安装完成后，使用前必须配置至少一个大模型 API Key。

### 7.1 打开设置页

1. 在 Word 中打开 **AI编辑助手** 侧栏
2. 点击侧栏右上角的 **设置按钮**（三点图标）

### 7.2 填写 API Key

在设置页中，分别为各平台填写 API Key：

| 平台 | 字段名 | 说明 |
|------|--------|------|
| DeepSeek | DeepSeek API Key | 推荐首选，默认使用 DeepSeek R1 |
| OpenAI | OpenAI API Key | 支持 GPT-4o 等模型 |
| 通义千问 | 通义千问 API Key | 支持通义千问 Plus/Turbo |

### 7.3 测试连接

1. 输入 API Key 后，点击对应平台的 **「测试连接」** 按钮
2. 显示 **「连接成功」** 表示配置正确
3. 若失败，检查 Key 是否有效、网络是否可达

### 7.4 保存设置

点击 **「保存设置」** 按钮。API Key 将保存在本机（`OfficeRuntime.storage` 或浏览器 `localStorage`），不会上传到远程服务器。

### 7.5 选择默认模型

在侧栏底部的模型下拉框中选择默认模型，例如 **DeepSeek R1**。选择后会自动记住偏好。

---

## 8. 使用说明

### 8.1 基本工作流程

```
选中 Word 文本 → 侧栏显示操作按钮 → 点击操作 → 预览 AI 结果 → 点击「应用」写回文档
```

### 8.2 选区操作

1. 在 Word 文档中用鼠标拖选一段文字
2. 侧栏自动从欢迎页切换为 **选区操作栏**
3. 显示已选字数和文本预览
4. 可点击以下按钮：

| 按钮 | 作用 |
|------|------|
| 汇总 | 提取核心信息，生成简洁摘要 |
| 精简 | 压缩篇幅，删除冗余 |
| 扩写 | 补充细节，扩展论述 |
| 润色 | 改善表达流畅度 |
| 翻译 | 中英文互译 |

### 8.3 预览与应用

1. 点击操作后，侧栏进入加载状态
2. AI 处理完成后显示 **结果预览**
3. 三个操作按钮：
   - **应用**：将结果替换到 Word 中选中的原文
   - **重新生成**：使用相同指令重新请求 AI
   - **放弃**：取消本次结果，返回操作栏

### 8.4 自定义对话

在侧栏底部输入框中：

- 直接输入指令，如「把这段话改得更正式一些」
- 输入 `/` 唤起预设指令菜单（`/汇总`、`/精简`、`/扩写` 等）
- 按 **Enter** 发送，**Shift + Enter** 换行

### 8.5 功能卡片

无选区时，欢迎页显示三张功能卡片：

| 卡片 | 作用 |
|------|------|
| 内容生成 | 根据上下文生成文档内容 |
| 文档调整 | 对选中文本进行智能润色 |
| 文档阅读 | 对选中文本进行要点汇总 |

> 后两张卡片需先选中 Word 文本后点击才生效。

---

## 9. 生产环境构建与发布

### 9.1 构建

```powershell
npm run build
```

### 9.2 校验 manifest

```powershell
npm run validate
```

确保输出 **「The manifest is valid.」**

### 9.3 发布检查清单

- [ ] `dist/manifest.xml` 中所有 URL 已替换为生产 HTTPS 地址
- [ ] 图标文件已部署且可访问
- [ ] LLM 代理服务已部署并配置防火墙
- [ ] 在 Word 2016/2019/365 上完成测试
- [ ] API Key 配置流程已验证
- [ ] 选区读写功能正常

### 9.4 发布到 Office Store（可选）

若需公开发布：

1. 注册 [Microsoft 合作伙伴中心](https://partner.microsoft.com) 账号
2. 提交 `manifest.xml` 及插件包
3. 通过微软审核后上架 Office 应用商店

---

## 10. 卸载与移除插件

### 10.1 开发模式

```powershell
npm run stop
```

然后在 Word 中：

1. **插入** → **我的加载项**
2. 找到 **AI编辑助手** → 右键 **删除**

### 10.2 手动旁加载

1. 删除注册表中的旁加载项（若使用了注册表方式）：
   ```
   HKEY_CURRENT_USER\Software\Microsoft\Office\16.0\WEF\Developer
   ```
2. 在 Word **我的加载项** 中删除插件
3. 重启 Word

### 10.3 清除本地数据

API Key 和设置保存在本机存储中。如需清除：

1. 打开插件侧栏设置页，清空 API Key 并保存
2. 或在浏览器开发者工具中清除 Office 加载项的本地存储

### 10.4 卸载开发证书（可选）

```powershell
npx office-addin-dev-certs uninstall
```

---

## 11. 常见问题排查

### Q1：Word 功能区看不到「AI编辑助手」按钮

**可能原因与解决：**

| 原因 | 解决方法 |
|------|----------|
| 开发服务未启动 | 先关闭旧终端，再执行 `npm start` 并保持运行 |
| 旁加载未完成 | 保持 `npm start` 运行，在**另一个终端**执行 `npm run sideload`（不会关闭 dev-server） |
| 端口被占用导致启动失败 | `npm start` 会自动释放 3000/3001 端口；若仍失败，手动关闭占用进程后重试 |
| loopback 权限未配置 | `npm start` 会自动配置；或手动执行 `npx office-addin-dev-settings appcontainer EdgeWebView --loopback --yes` |
| manifest 未注册 | 执行 `npx office-addin-dev-settings register manifest.xml` |
| Word 未重启 | 完全退出 Word（包括后台进程）后重新打开 |

**按钮位置**：插件入口在 Word **「开始」** 选项卡右侧的 **「AI编辑助手」** 分组中（与 DeepL 等加载项相邻），点击按钮打开侧栏。侧栏右侧竖条也会显示插件缩略图图标。

### Q2：侧栏显示「加载项错误 - 使用此功能所需的服务已关闭，请检查你的隐私设置」

这是 Word 阻止加载在线/本地服务内容导致的，按以下顺序排查：

**步骤 1：确认开发服务正在运行**

```powershell
npm start
```

必须保持终端运行，且日志中应出现 `webpack compiled successfully` 和 `LLM proxy server running`。

**步骤 2：开启 Word 连接体验（最关键）**

1. 打开 Word → **文件** → **选项**
2. 点击左下角 **隐私设置**（或 **文件 → 帐户 → 管理设置**）
3. 勾选以下选项：
   - **开启所有已连接的体验**
   - **启用下载在线内容的体验**
4. 点击 **确定**，按提示 **重启 Word**

**步骤 3：信任开发证书（若侧栏空白）**

```powershell
npx office-addin-dev-certs install
```

**步骤 4：重新旁加载**

保持 `npm start` 终端继续运行，另开一个终端执行：

```powershell
npm run sideload
```

> `npm run sideload` 已改为不释放 3000/3001 端口，可与 `npm start` 同时运行。

### Q3：侧栏打开后显示空白

**可能原因与解决：**

| 原因 | 解决方法 |
|------|----------|
| HTTPS 证书未信任 | 执行 `npx office-addin-dev-certs install` |
| 端口被占用 | 检查 3000/3001 端口，关闭占用进程 |
| 浏览器缓存 | 在侧栏中按 `Ctrl + F5` 强制刷新 |

### Q3：选中文字后侧栏没有反应

**可能原因与解决：**

| 原因 | 解决方法 |
|------|----------|
| 选区事件延迟 | 稍等片刻或重新选中文字 |
| 选中的是图片/表格 | 当前仅支持文本选区，请选中纯文本 |
| 侧栏未打开 | 需先点击功能区按钮打开侧栏 |

### Q4：AI 操作报错「未提供 API Key」

1. 打开侧栏设置页
2. 确认已填写对应平台的 API Key
3. 点击「测试连接」验证
4. 保存设置后重试

### Q5：AI 请求失败 / 连接超时

| 原因 | 解决方法 |
|------|----------|
| 代理服务未启动 | 确认 `npm start` 中 server 进程正常 |
| API Key 无效 | 在平台官网检查 Key 状态和余额 |
| 网络不通 | 检查是否能访问对应 API 域名 |
| 模型名称错误 | 在设置中切换其他模型重试 |

### Q6：点击「应用」后提示「选区已失效」

用户在 AI 处理期间修改了选区或移动了光标。

**解决方法：** 重新选中目标文本，再次执行操作。

### Q7：`npm start` 报证书错误

```powershell
# 重新安装开发证书
npx office-addin-dev-certs install --days 365

# 若仍失败，先卸载再安装
npx office-addin-dev-certs uninstall
npx office-addin-dev-certs install
```

### Q8：PowerShell 中 `&&` 报错

旧版 PowerShell 不支持 `&&`，请分步执行：

```powershell
Set-Location "E:\2-AIprogram\2-word插件\AI编辑助手"
npm install
npm start
```

---

## 12. 附录

### 12.1 项目目录说明

```
AI编辑助手/
├── manifest.xml              # Office 插件清单（核心配置文件）
├── package.json              # 项目依赖与脚本
├── webpack.config.js         # 前端构建配置
├── server/
│   └── index.js              # LLM API 本地代理（端口 3001）
├── src/
│   ├── taskpane/             # 侧栏 React 应用
│   │   ├── App.tsx           # 主应用
│   │   ├── components/       # UI 组件
│   │   ├── hooks/            # 选区监听、对话逻辑
│   │   ├── services/         # Word API、LLM、存储服务
│   │   ├── prompts/          # AI 操作 Prompt 模板
│   │   └── styles/           # 界面样式
│   └── commands/             # Ribbon 按钮命令
├── assets/                   # 插件图标
├── dist/                     # 生产构建输出（npm run build 后生成）
└── scripts/
    └── generate-icons.js     # 图标生成脚本
```

### 12.2 常用命令速查

| 命令 | 作用 |
|------|------|
| `npm install` | 安装依赖 |
| `npm start` | 启动开发服务 + 旁加载到 Word |
| `npm run stop` | 停止旁加载 |
| `npm run build` | 构建生产包到 dist/ |
| `npm run validate` | 校验 manifest.xml |
| `npm run server` | 仅启动 LLM 代理 |
| `npm run dev-server` | 仅启动前端开发服务 |

### 12.3 支持的 Word 版本

根据 manifest 校验结果，本插件兼容：

- Word 2013 及更高版本（Windows）
- Word 2016 及更高版本（Windows / Mac）
- Word 2019 及更高版本（Windows / Mac）
- Microsoft 365 Word（Windows / Mac / iPad / Web）

### 12.4 相关链接

- [Office Add-in 官方文档](https://learn.microsoft.com/office/dev/add-ins/)
- [Word JavaScript API](https://learn.microsoft.com/javascript/api/word)
- [旁加载 Office 加载项](https://learn.microsoft.com/office/dev/add-ins/testing/test-debug-office-add-ins)
- [Shared Runtime 配置](https://learn.microsoft.com/office/dev/add-ins/develop/configure-your-add-in-to-use-a-shared-runtime)

---

**文档版本**：1.0.0  
**最后更新**：2026-07-13  
**适用插件版本**：AI编辑助手 v1.0.0
