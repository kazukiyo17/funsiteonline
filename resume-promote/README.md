# ResumePromote（简历优化）

基于 **自建静态前端 + EdgeOne Pages Cloud Functions + [Dify](https://dify.ai) Workflow** 的在线简历优化工具：用户上传或粘贴**简历**与**目标岗位 JD**（支持 Word/PDF 与纯文本），后端调用 Dify 工作流，前端展示 **HTML 简历预览**（可新标签页打开）与 **Markdown 格式的提升建议**。

更完整的产品与流程说明见 [docs/design.md](./docs/design.md)；前端结构与安全约定见 [docs/frontend-architecture.md](./docs/frontend-architecture.md)。

---

## 功能概览

- 简历 / JD：**文件**（Word、PDF）或**文本**二选一或组合（至少各有一条有效输入）。
- **优化简历**：iframe 内预览返回的 HTML；悬浮按钮支持**在新标签页打开**便于另存。
- **提升建议**：`suggestions` 字段按 **Markdown** 渲染（`marked` + `DOMPurify`，通过 import map 从 `esm.sh` 加载）。
- **本地 mock**：在 `index.html` 的 `window.__ENV__` 中开启 `MOCK_OPTIMIZE`，无需真实 `/api/optimize` 即可调试 UI（详见下文）。
- 页面文案提示：**不落库存储**，生成内容请用户自行保存。

---

## 仓库结构（简要）

| 路径 | 说明 |
|------|------|
| `index.html`、`css/`、`js/` | 静态站点（原生 ES Module，无打包步骤） |
| `cloud-functions/api/optimize.js` | Pages Functions：**`POST /api/optimize`**，multipart → Dify 上传与工作流 |
| `edgeone.json` | Cloud Functions **`maxDuration`**（默认 120s）等 |
| `docs/` | 设计与前端架构文档 |
| `CONFIGURATION.md` | **环境变量、路由、本地调试**的权威说明 |

部署产物目录 `.edgeone/` 若存在，一般为平台/CLI 生成物，日常以 `cloud-functions/` 与静态文件为准即可。

---

## 快速开始

### 1. 仅预览前端（不调后端）

需要本地 HTTP 服务（避免 `file://` 下 ES Module 被拦截）：

```bash
npx --yes serve .
```

在 `index.html` 中可将 `window.__ENV__.MOCK_OPTIMIZE` 设为 `true`，使用 `js/api/mock-optimize.js` 的固定返回联调界面。

### 2. 联调真实 Dify（EdgeOne Pages + Functions）

1. 在 Dify 发布 **Workflow 应用**，创建 **API Key**；工作流开始/结束节点的变量名需与后端默认或环境变量映射一致（见 `CONFIGURATION.md`）。
2. 在 EdgeOne Pages 项目中配置环境变量（至少 **`DIFY_API_KEY`**），或使用本地 **`.env`** 配合 CLI。
3. 安装并登录 [EdgeOne CLI](https://pages.edgeone.ai/zh/document/edgeone-cli)，在项目根目录执行：

```bash
edgeone pages dev
```

浏览器访问 CLI 提示的地址（常见为 `http://localhost:8088/`）。前端 **`API_BASE` 保持空字符串**，请求发往同源的 **`/api/optimize`**。

变量说明、输入输出字段名映射、CORS 与路由冲突等，一律以 **[CONFIGURATION.md](./CONFIGURATION.md)** 为准。

---

## API 契约（摘要）

- **`POST /api/optimize`**，`Content-Type: multipart/form-data`
- 字段示例：`resume_str`、`job_desc`、`resume_file`、`jd_file`（详见 `CONFIGURATION.md` 与 `docs/frontend-architecture.md`）
- 成功时返回 JSON：`optimizedText`、`html`、`suggestions` 等（`matchScore` 仍可由后端返回，当前前端不展示）

---

## 安全与合规提示

- **切勿**将 `DIFY_API_KEY` 或真实 `.env` 提交到 Git。
- HTML 预览使用 iframe；生产环境仍建议对返回的 `html` 做服务端消毒（见 `CONFIGURATION.md`）。
- 「不存储」为产品侧表述；实际上游（如 Dify 云服务）日志与留存策略请以其官方说明为准。

---

## 许可

若仓库未单独提供许可证文件，默认以仓库所有者声明为准；使用前请自行确认。
