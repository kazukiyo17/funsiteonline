# 本项目用到的 EdgeOne 与 Dify 能力说明

本文说明 **JobMatchStar / resume-promote** 实际接入的 **EdgeOne Pages** 与 **Dify** 能力，便于答辩、参赛视频口播或文档引用。实现细节仍以 [design.md](./design.md) 与代码为准。

---

## 一、EdgeOne Pages 侧

### 1.1 静态站点托管

| 能力 | 在本项目中的用途 |
| --- | --- |
| **静态资源托管** | 托管 `index.html`、`css/`、`js/` 等无构建前端，浏览器直接访问页面 |

### 1.2 Cloud Functions（Node.js）

| 能力 | 在本项目中的用途 |
| --- | --- |
| **同项目内的 HTTP 函数** | `POST /api/optimize` 由 `cloud-functions/api/optimize.js` 提供，与静态页同源部署，前端 `fetch` 同一站点路径即可 |
| **解析 multipart 表单** | 使用标准 Web API `request.formData()` 读取 `resume_str`、`job_desc`、`resume_file`、`jd_file` |
| **自定义响应** | 返回 JSON 错误体、HTTP 状态码、`Retry-After`（限流时）、`OPTIONS` 预检与 CORS 响应头（`CORS_ORIGIN`） |
| **环境变量** | 在 Pages 控制台配置 `DIFY_API_KEY`、`DIFY_API_URL`、`DIFY_INPUT_*`、`DIFY_OUTPUT_*`、`MAX_*`、`RATE_LIMIT_*` 等，函数内通过 `env` 读取 |

### 1.3 函数运行时配置（`edgeone.json`）

| 配置项 | 当前值 | 说明 |
| --- | --- | --- |
| **`cloudFunctions.nodejs.maxDuration`** | `120`（秒） | 拉长单次函数执行上限，适配 Dify **blocking** 工作流可能长达数分钟的执行时间（与边缘短超时方案对比见 `optimize.js` 文件头注释） |

### 1.4 Pages KV（可选）

| 能力 | 在本项目中的用途 |
| --- | --- |
| **KV 读写** | `rate-limit.js` 通过绑定名（默认 `RESUME_PROMOTE_KV`）对请求计数 |
| **固定窗口限流** | 支持 **按客户端 IP** 与 **全站** 两套规则；超限返回 `429` 与可读文案，响应头带 `Retry-After` |
| **fail-open / fail-closed** | `RATE_LIMIT_FAIL_OPEN`：KV 未绑定或读写异常时，可选择放行或拒绝，便于本地与生产差异化配置 |

### 1.5 本地开发与联调

| 能力 | 在本项目中的用途 |
| --- | --- |
| **EdgeOne CLI · `edgeone pages dev`** | 本地起 Pages 兼容环境（常见 `http://localhost:8088/`），静态页与 `/api/optimize` 同源联调 |

> **说明**：本项目选用 **Cloud Functions** 承载长耗时、较大请求体的 Dify 调用；未使用 **Edge Functions** 跑整条 LLM 链路（体积与 CPU 限制更严），该取舍见 `optimize.js` 顶部注释。

---

## 二、Dify 侧

### 2.1 应用形态

| 能力 | 在本项目中的用途 |
| --- | --- |
| **Workflow（工作流）应用** | 多步 LLM 与（可选）工具链在 Dify 画布编排；后端只负责触发运行与取回 **outputs**，不在浏览器直连 Dify |

### 2.2 已使用的 HTTP API

| API | 作用 |
| --- | --- |
| **`POST /v1/files/upload`** | 将用户上传的简历 / JD 文件上传到 Dify，得到 `id`，供工作流输入里以 `local_file` 引用 |
| **`POST /v1/workflows/run`** | 以 **`response_mode: "blocking"`** 同步等待工作流结束，在响应中读取 `outputs` |

### 2.3 请求与工作流约定

| 能力点 | 说明 |
| --- | --- |
| **`inputs` 映射** | 默认键名 `resume_str`、`job_desc`、`resume_file`、`jd_file`；可通过环境变量 `DIFY_INPUT_*` 与工作流开始节点对齐 |
| **文件输入格式** | 非空文件时，传入 `transfer_method: "local_file"`、`upload_file_id`、`type: "document"` 等结构（与 Dify 工作流「文件」变量类型一致） |
| **`user` 字段** | 上传与工作流运行携带同一 `user` 标识（请求头 `x-user-id` → `DIFY_DEFAULT_USER` → 默认 `resume-promote-web`），便于 Dify 侧区分调用方 |
| **`outputs` 映射** | 默认从 `resume_text`、`resume_html`、`suggestions`、`analyse`、`matchScore`、`modificationPoints` 等 key 取值，映射为 API 的 `optimizedText`、`html`、`suggestions`、`analysis` 等；可通过 `DIFY_OUTPUT_*` 覆盖 |

### 2.4 在工作流内可发挥的能力（需在 Dify 控制台配置）

以下属于 **Dify 产品能力**，由你在工作流里选用；后端已预留输入输出字段，便于对接。

| 能力 | 典型用途（与本项目相关） |
| --- | --- |
| **多节点 LLM** | 解析 JD、差距分析、改写简历、生成 HTML、生成 Markdown 建议等多段提示词流水线 |
| **开始节点变量** | 文本变量 + 文件变量，与后端 `inputs` 一致即可 |
| **结束节点 / 输出变量** | 将各节点结果汇总为 Workflow **outputs**，与上表 `DIFY_OUTPUT_*` 对齐 |

---

## 三、两者如何对接（一句话链路）

1. 浏览器向 **EdgeOne Pages** 上的 **Cloud Function** 提交 **multipart**（文本 + 可选文件）。  
2. 函数校验、（可选）KV 限流后，对文件调用 Dify **`/v1/files/upload`**。  
3. 组装 **`/v1/workflows/run`** 的 `inputs`，**blocking** 等待结果。  
4. 将 `outputs` 映射为统一 JSON，返回给静态前端渲染（HTML iframe、Markdown 等）。

更完整的契约与错误码见 [design.md](./design.md) 第三节。

---

## 四、变更记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-15 | 初版：按仓库实现整理 EdgeOne Pages 与 Dify 已用能力 |
