# GitHub + Vercel 部署指南

将 **AI编辑助手** 推送到 GitHub，再通过 Vercel 自动构建与托管。部署完成后，Word 从公网 HTTPS 地址加载插件，本机无需运行 `npm start`。

---

## 一、流程概览

```
本地项目 → GitHub 仓库 → Vercel Import → 自动 build → 获得 HTTPS 域名
                                                      ↓
                                            Word 上传 manifest.xml（一次性）
```

---

## 二、上传到 GitHub

### 2.1 在 GitHub 创建空仓库

1. 登录 [https://github.com](https://github.com)（你的账号如 `TTpodopd`）
2. 右上角 **+** → **New repository**
3. 填写：
   - **Repository name**：`ai-word-editor`（可自定）
   - **Visibility**：Private 或 Public
   - **不要**勾选 "Add a README"（本地已有代码）
4. 点击 **Create repository**

创建后会看到仓库地址，例如：

```
https://github.com/TTpodopd/ai-word-editor.git
```

### 2.2 在本地提交并推送

在项目目录打开 **PowerShell**：

```powershell
cd "E:\2-AIprogram\2-word插件\AI编辑助手"

# 安装依赖（确保 package-lock.json 最新）
npm install

# 首次提交
git add .
git commit -m "Initial commit: AI Word editor add-in with Vercel support"

# 关联远程仓库（替换为你的 GitHub 地址）
git remote add origin https://github.com/TTpodopd/ai-word-editor.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

> 若提示需要登录 GitHub，可使用 **GitHub Desktop**、**Personal Access Token**，或 SSH 地址 `git@github.com:TTpodopd/ai-word-editor.git`。

### 2.3 确认 .gitignore

以下内容**不会**上传（已在 `.gitignore` 中）：

- `node_modules/`
- `dist/`
- `.env`（切勿把 API Key 提交到 GitHub）

---

## 三、在 Vercel 导入项目

### 3.1 Import 仓库

1. 打开 [https://vercel.com/new](https://vercel.com/new)
2. 左侧 **Import Git Repository** 中找到 `ai-word-editor`
3. 若列表没有，点击 **Adjust GitHub App Permissions**，授权访问该仓库
4. 点击仓库右侧 **Import**

### 3.2 配置构建设置

Vercel 一般会自动读取 `vercel.json`，确认如下：

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Other |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

无需修改则直接 **Deploy**。

### 3.3 首次部署

等待 1～3 分钟。成功后得到地址，例如：

```
https://ai-word-editor-xxxx.vercel.app
```

在浏览器打开：

- `https://你的域名.vercel.app/taskpane.html` — 应显示侧栏页面
- `https://你的域名.vercel.app/api/health` — 应返回 JSON

---

## 四、配置生产域名（可选）

### 4.1 使用 Vercel 默认域名（最快）

在 Vercel 项目 → **Settings** → **Environment Variables** 添加：

| Name | Value | Environment |
|------|-------|-------------|
| `ADDIN_BASE_URL` | `https://ai-word-editor-xxxx.vercel.app` | Production |

保存后 **Redeploy** 一次，使 `manifest.xml` 中的 URL 指向正确域名。

### 4.2 绑定自定义域名 `milei.dpdns.org`

1. Vercel 项目 → **Settings** → **Domains**
2. 添加 `milei.dpdns.org`
3. 按提示在 DNS 添加 **CNAME**：
   - 名称：`milei`
   - 值：`cname.vercel-dns.com`（以 Vercel 页面显示为准）
4. 环境变量改为：

| Name | Value |
|------|-------|
| `ADDIN_BASE_URL` | `https://milei.dpdns.org` |

5. **Deployments** → 最新部署 → **Redeploy**

---

## 五、在 Word 中安装加载项（一次性）

1. 从 Vercel 部署产物获取 manifest：
   - 浏览器打开 `https://你的域名/taskpane.html` 确认可访问
   - manifest 地址：`https://你的域名/manifest.xml`
2. 下载该 manifest，或在本地 `npm run build` 后使用 `dist/manifest.xml`（URL 需与线上一致）
3. Word → **插入** → **我的加载项** → **上传我的加载项**
4. 选择 `manifest.xml`
5. 在 **开始** 选项卡点击 **AI编辑助手** 打开侧栏
6. 在设置中填写 API Key

之后无需本机运行任何服务。

---

## 六、后续更新代码

```powershell
git add .
git commit -m "描述你的修改"
git push
```

Vercel 会自动重新构建部署。Word 侧栏可按 `Ctrl + F5` 强制刷新。

---

## 七、Vercel 免费版限制

| 项目 | 限制 | 影响 |
|------|------|------|
| 请求体大小 | 约 4.5 MB | 超大 PDF/Word 上传可能失败 |
| 函数超时 | 10 秒 | 极长 AI 回复可能超时 |
| 流量 | 每月一定免费额度 | 个人使用通常足够 |

核心功能（选区编辑、对话、图片分析、公式）可正常使用。

---

## 八、常见问题

### Q：GitHub 推送失败 `Authentication failed`

使用 Personal Access Token 代替密码，或安装 GitHub Desktop 登录后推送。

### Q：Vercel 构建失败

在 Vercel **Deployments** → 失败记录 → **Building** 日志中查看错误。常见原因：

- `npm install` 失败 → 检查 `package.json`
- `npm run build` 失败 → 本地先执行 `npm run build` 验证

### Q：侧栏能开但 AI 报错

1. 检查 `https://你的域名/api/health`
2. 确认侧栏设置里已填写 API Key
3. Word 隐私设置中开启「已连接的体验」

### Q：manifest URL 仍是 localhost

在 Vercel 设置 `ADDIN_BASE_URL` 环境变量后 **Redeploy**。

---

**文档版本**：1.0.0  
**最后更新**：2026-07-14
