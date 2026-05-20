# 职配星 / JobMatchStar · 测试用例

本文档基于 [design.md](./design.md) 与当前代码实现整理，覆盖前端交互、API 契约、限流、会话恢复与安全相关场景。产品需求与 API 细节以设计文档为准。

---

## 1. 文档说明

| 项 | 说明 |
| --- | --- |
| 适用版本 | 当前 `resume-promote/` 目录实现 |
| 关联文档 | [design.md](./design.md)、[README.md](../README.md) |
| 用例编号 | `模块-序号`，如 `FE-001`、`API-003` |
| 优先级 | **P0** 阻塞发布；**P1** 重要功能；**P2** 体验/边界 |

### 1.1 测试环境

| 模式 | 启动方式 | 用途 |
| --- | --- | --- |
| Mock 前端 | `npx serve .` + `MOCK_OPTIMIZE=true` | UI、校验、会话恢复，无需 Dify |
| 本地联调 | `edgeone pages dev` + `.env` 配置 `DIFY_API_KEY` | 端到端真实工作流 |
| 生产验收 | EdgeOne Pages 已部署 + KV 限流（可选） | 上线前回归 |

### 1.2 默认限额（前后端一致）

| 变量 | 默认值 |
| --- | --- |
| `MAX_FILE_BYTES` | 5 MB |
| `MAX_RESUME_TEXT_CHARS` | 2800 字 |
| `MAX_JD_TEXT_CHARS` | 1000 字 |
| `MAX_REQUEST_BYTES` | 12 MB |

### 1.3 测试数据准备

- **简历文本样例**：200～500 字中文简历正文
- **JD 文本样例**：100～300 字岗位描述
- **简历文件**：≤ 5 MB 的 `.pdf` / `.doc` / `.docx` 各一份
- **JD 文件**：≤ 5 MB 的 `.pdf` / `.doc` / `.docx` 各一份
- **超限文件**：> 5 MB 的 PDF（用于 413 校验）
- **超长文本**：> 2800 字简历、> 1000 字 JD（可用重复段落生成）

---

## 2. 前端功能测试（FE）

### 2.1 页面与布局

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| FE-001 | P0 | 页面正常加载 | 本地 HTTP 服务可访问 | 打开 `index.html` | 标题、输入区、操作按钮、结果 Tab、隐私说明均可见；无控制台致命错误 |
| FE-002 | P1 | 响应式布局 | 同 FE-001 | 缩放浏览器至手机宽度（≤ 480px） | 表单与结果区可读，无横向溢出；按钮可点击 |
| FE-003 | P1 | 限额提示展示 | 同 FE-001 | 查看简历/JD 区域底部提示 | 显示「单文件 ≤ 5MB」「简历文本 ≤ 2,800 字」「JD 文本 ≤ 1,000 字」类文案 |

### 2.2 输入与拖拽

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| FE-010 | P0 | 简历文本输入 | 页面已加载 | 在简历文本框粘贴样例简历 | 文本显示正常；字数计数随输入更新 |
| FE-011 | P0 | JD 文本输入 | 页面已加载 | 在 JD 文本框粘贴样例 JD | 同上 |
| FE-012 | P0 | 选择简历文件 | 有效 PDF/Word | 点击「选择文件」选简历 | 显示文件名徽章；dropzone 有 `has-file` 样式 |
| FE-013 | P0 | 选择 JD 文件 | 有效 PDF/Word | 同上，选 JD 区域 | 同上 |
| FE-014 | P1 | 拖拽上传简历 | 有效文件 | 将文件拖入简历 dropzone | 松手后文件被选中，显示文件名 |
| FE-015 | P1 | 拖拽悬停样式 | 同 FE-014 | 拖入时悬停、拖出时离开 | 悬停时 `is-dragover`；离开后移除 |
| FE-016 | P1 | 清除已选文件 | 已选文件 | 点击文件徽章旁清除按钮 | 文件移除，徽章隐藏 |
| FE-017 | P1 | 文本与文件并存 | 同区域 | 同时填写文本并选择文件 | 提交时两者均进入 FormData（见 FE-030） |
| FE-018 | P2 | 拖入超大文件 | > 5 MB 文件 | 拖入简历区 | 表单提示区显示「文件过大…」；文件不被接受 |
| FE-019 | P2 | `accept` 限制 | 页面已加载 | 尝试选择 `.txt` 等非 PDF/Word（若系统允许） | 理想情况文件选择器过滤；若强行提交由后端/Dify 处理 |

### 2.3 字数计数

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| FE-020 | P1 | 实时字数 | 页面已加载 | 逐字输入简历/JD | 显示 `当前 / 上限 字` 格式 |
| FE-021 | P1 | textarea maxLength | 页面已加载 | 尝试粘贴超过上限的文本 | 浏览器截断至 `maxResumeText` / `maxJdText` |

### 2.4 提交与结果展示

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| FE-030 | P0 | 文本+文本成功提交 | `MOCK_OPTIMIZE=true` 或真实 API | 填写简历与 JD 文本，点击「开跑优化」 | 按钮禁用并显示加载态；完成后结果区展开 |
| FE-031 | P0 | 文件+文件成功提交 | 真实 API + Dify | 仅上传简历与 JD 文件 | HTTP 200；四个 Tab 有内容 |
| FE-032 | P0 | 文本+文件组合 | 真实 API | 简历文本 + JD 文件（或反之） | 成功返回结果 |
| FE-033 | P0 | 导出简历 Tab | 优化成功 | 默认或切换到「导出简历」 | iframe 内 HTML 预览正常；含基础样式 |
| FE-034 | P0 | 优化简历 Tab | 优化成功 | 切换到「优化简历」 | `optimizedText` 经 Markdown 渲染显示 |
| FE-035 | P0 | 简历分析 Tab | 优化成功 | 切换到「简历分析」 | `analysis` 经 Markdown 渲染显示 |
| FE-036 | P0 | 提升建议 Tab | 优化成功 | 切换到「提升建议」 | `suggestions` 经 Markdown 渲染显示 |
| FE-037 | P1 | 新标签页打开 HTML | 已有 HTML 结果 | 点击「在新标签页打开」 | 新窗口展示完整 HTML；可打印/另存 |
| FE-038 | P1 | 无 HTML 时打开 | 未优化或已清空 | 点击「在新标签页打开」 | 表单提示「当前没有可打开的 HTML 简历…」 |
| FE-039 | P1 | 提交中重复点击 | 长耗时请求进行中 | 再次点击提交（或快速连点） | 上一次请求被 abort；仅最新一次生效 |
| FE-040 | P1 | 加载态文案 | Mock 延迟 > 0 | 提交后观察状态区 | 显示「AI 正在加班加点打磨简历…」 |
| FE-041 | P2 | matchScore 未展示 | 优化成功 | 检查页面 DOM | 当前实现不展示 `matchScore`、`modificationPoints`（契约已预留） |

### 2.5 清空与重置

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| FE-050 | P0 | 清空表单 | 已有输入与结果 | 点击「清空」 | 文本框、文件、结果区、iframe 预览全部重置；状态区隐藏 |
| FE-051 | P1 | 清空中断请求 | 提交进行中 | 点击「清空」 | 进行中的请求被 abort；按钮恢复可点 |

---

## 3. 前端校验测试（VAL）

前端在 `forms.js` / `limits.js` 预校验，错误展示在 `#form-hint`。

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| VAL-001 | P0 | 缺少简历 | 页面已加载 | 仅填 JD，提交 | 提示「请至少提供一种个人简历（文件或文本）。」；不发起请求 |
| VAL-002 | P0 | 缺少 JD | 页面已加载 | 仅填简历，提交 | 提示「请至少提供一种岗位 JD（文件或文本）。」 |
| VAL-003 | P0 | 简历文本超长 | 后端限额 2800 | 构造 > 2800 字（绕过 maxLength 或调低限额测试） | 提示含「简历文本不超过…字」 |
| VAL-004 | P0 | JD 文本超长 | 后端限额 1000 | 构造 > 1000 字 | 提示含「JD 文本不超过…字」 |
| VAL-005 | P0 | 简历文件过大 | > 5 MB 文件 | 选文件后提交（若拖入已被拦截则直接提交超大 file input） | 提示「简历文件不超过 5MB」 |
| VAL-006 | P0 | JD 文件过大 | > 5 MB 文件 | 同上 | 提示「JD 文件不超过 5MB」 |
| VAL-007 | P1 | 请求体合计过大 | 文本+多文件接近 12 MB | 同时提交大文本与大文件 | 提示「本次提交内容过大，请缩小文件或精简文本后重试。」 |
| VAL-008 | P1 | 空白文本不计入 | 仅空格/换行 | 简历填空格，JD 有内容 | 视为无简历，触发 VAL-001 |
| VAL-009 | P1 | 空文件不计入 | size=0 文件 | 若可选中空文件 | 视为未提供文件 |

---

## 4. API 接口测试（API）

接口：`POST /api/optimize`，`Content-Type: multipart/form-data`。可用 `curl`、Postman 或脚本验证。

### 4.1 正常路径

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| API-001 | P0 | 文本+文本 200 | `DIFY_API_KEY` 已配置 | POST `resume_str` + `job_desc` | `200`；JSON 含 `optimizedText`、`html`、`analysis`、`suggestions`；`meta.requestId` 存在 |
| API-002 | P0 | 文件+文件 200 | 同上 | POST `resume_file` + `jd_file` | `200`；字段完整 |
| API-003 | P0 | 混合输入 200 | 同上 | 文本+文件任意组合 | `200` |
| API-004 | P1 | OPTIONS 预检 | CORS 配置 | `OPTIONS /api/optimize` | `204`；含 `Access-Control-Allow-*` |
| API-005 | P1 | 输出字段映射 | 自定义 `DIFY_OUTPUT_*` | 配置与环境变量对齐后请求 | 响应字段名仍为 API 契约字段（`optimizedText` 等） |

### 4.2 错误响应

统一格式：`{ "error": { "code": "...", "message": "..." } }`。

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| API-010 | P0 | 缺少 API Key | 未配置 `DIFY_API_KEY` | POST 有效表单 | `500`；`code: MISSING_DIFY_API_KEY` |
| API-011 | P0 | 缺少简历 | Key 已配置 | 仅 `job_desc` | `422`；`code: MISSING_RESUME` |
| API-012 | P0 | 缺少 JD | Key 已配置 | 仅 `resume_str` | `422`；`code: MISSING_JD` |
| API-013 | P0 | 简历文本超长 | Key 已配置 | `resume_str` 超长 | `422`；`code: RESUME_TEXT_TOO_LONG` |
| API-014 | P0 | JD 文本超长 | Key 已配置 | `job_desc` 超长 | `422`；`code: JD_TEXT_TOO_LONG` |
| API-015 | P0 | 简历文件过大 | Key 已配置 | 上传超大 `resume_file` | `413`；`code: RESUME_FILE_TOO_LARGE` |
| API-016 | P0 | JD 文件过大 | Key 已配置 | 上传超大 `jd_file` | `413`；`code: JD_FILE_TOO_LARGE` |
| API-017 | P1 | 请求体过大 | Key 已配置 | `Content-Length` 或合计超限 | `413`；`code: PAYLOAD_TOO_LARGE` |
| API-018 | P1 | 非法 multipart | Key 已配置 | `Content-Type: multipart` 但 body 损坏 | `400`；`code: BAD_MULTIPART` |
| API-019 | P1 | 工作流失败 | Dify 返回非 succeeded | 触发工作流错误（如错误 Key/输入） | `502`；`code: WORKFLOW_FAILED` 或 `UPSTREAM_ERROR` |
| API-020 | P1 | Dify 上游异常 | 断网或错误 URL | `DIFY_API_URL` 不可达 | `502`；`code: UPSTREAM_ERROR`；`message` 人类可读 |

### 4.3 前端错误展示

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| API-030 | P0 | 展示后端 message | 触发 API-011 | 页面提交等效数据 | 状态区红色展示 `error.message` |
| API-031 | P1 | 网络异常 | 关闭服务或错误 `API_BASE` | 提交 | 「网络异常，请检查网络或 API 地址配置。」 |
| API-032 | P1 | 请求超时 | 超时 < 180s 的慢响应 | 等待超过 `timeoutMs`（180s） | 「请求超时或已取消，请稍后重试。」 |
| API-033 | P1 | 429 限流文案 | 触发限流（见 RL） | 页面提交 | 展示限流 `message`（如约 N 分钟后再试） |

---

## 5. 限流测试（RL）

依赖 KV 绑定；本地无 KV 时默认 **fail-open**（放行）。

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| RL-001 | P1 | 未启用限流 | `RATE_LIMIT_IP_MAX_REQUESTS=0` 且全站为 0 | 连续多次 POST | 均 `200`（在 Dify 配额内） |
| RL-002 | P0 | IP 超限 | KV 已绑定；`RATE_LIMIT_IP_MAX_REQUESTS=2` | 同 IP 第 3 次请求 | `429`；`code: RATE_LIMIT_IP_EXCEEDED`；响应头 `Retry-After` |
| RL-003 | P0 | 全站超限 | `RATE_LIMIT_GLOBAL_MAX_REQUESTS` 设为较小值 | 多 IP 累计超过全站阈值 | `429`；`code: RATE_LIMIT_GLOBAL_EXCEEDED` |
| RL-004 | P1 | 先全站后 IP | 两者均启用 | 分别触发两种阈值 | 错误码与文案区分（全站：「当前使用人数较多…」；IP：「请求过于频繁…」） |
| RL-005 | P1 | fail-open（无 KV） | 未绑定 KV；`RATE_LIMIT_FAIL_OPEN=true` | 启用限流配置但无 KV | 请求放行；服务端日志 warn |
| RL-006 | P2 | fail-closed | `RATE_LIMIT_FAIL_OPEN=false` 且无 KV | POST | `429` 或限流配置异常文案 |
| RL-007 | P2 | 窗口重置 | 短窗口（测试环境调低 `RATE_LIMIT_WINDOW_SEC`） | 超限后等待窗口结束 | 再次请求成功 |

---

## 6. 会话与草稿恢复（SS）

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| SS-001 | P0 | 结果刷新恢复 | 优化成功 | F5 刷新同标签页 | 四个 Tab 内容恢复；上次激活 Tab 恢复 |
| SS-002 | P0 | 表单草稿恢复 | 已输入文本/选文件 | 刷新页面 | 文本与文件（IndexedDB）恢复 |
| SS-003 | P1 | Tab 切换持久化 | 有结果 | 切换到「提升建议」后刷新 | 激活 Tab 为 `tips` |
| SS-004 | P1 | 清空清除会话 | 有结果与草稿 | 点击「清空」 | `sessionStorage` / IndexedDB 草稿清除；刷新后为空 |
| SS-005 | P2 | 新标签页隔离 | 优化成功 | 新开同 URL 标签页 | 新标签无上一标签 session（浏览器默认行为） |
| SS-006 | P2 | 隐私模式 | 浏览器禁用存储 | 输入并刷新 | 不崩溃；可能无法恢复（可接受） |

---

## 7. Mock 模式测试（MOCK）

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| MOCK-001 | P0 | Mock 开关 | `MOCK_OPTIMIZE=true` | 提交有效表单 | 不请求 `/api/optimize`；返回 `mock-optimize.js` 固定数据 |
| MOCK-002 | P1 | Mock 延迟 | `MOCK_DELAY_MS=2000` | 提交 | 约 2s 后出结果；期间加载态 |
| MOCK-003 | P1 | Mock 中断 | Mock 延迟中 | 清空或再次提交 | 显示超时/取消类文案 |
| MOCK-004 | P1 | 上线配置 | 生产 `index.html` | 检查 `MOCK_OPTIMIZE` | 必须为 `false` |

---

## 8. 安全测试（SEC）

| ID | 优先级 | 用例名称 | 前置条件 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | P0 | API Key 不泄露 | 真实环境 | 查看页面源码、Network、控制台 | 无 `DIFY_API_KEY`；请求不经浏览器直连 Dify |
| SEC-002 | P0 | HTML iframe 沙箱 | 优化返回含 script 的 HTML | 查看 `#preview-frame` | `sandbox=""`；脚本不在主文档执行 |
| SEC-003 | P0 | Markdown XSS | suggestions 含 `<script>` | 渲染提升建议 | DOMPurify 过滤，不执行脚本 |
| SEC-004 | P1 | 主文档无简历日志 | 生产构建 | 提交后查控制台 | 无完整简历/JD `console.log` |
| SEC-005 | P1 | CORS | `CORS_ORIGIN` 设为指定源 | 异源页面 fetch API | 非允许源被浏览器拦截 |
| SEC-006 | P2 | Blob URL 清理 | 新标签打开 HTML | 打开后等待 2 分钟 | `revokeObjectURL` 已调用（内存不泄漏） |

---

## 9. 端到端验收（E2E）

对应 [design.md §6.2](./design.md#62-edgeone-pages) 验收清单。

| ID | 优先级 | 用例名称 | 测试步骤 | 预期结果 |
| --- | --- | --- | --- | --- |
| E2E-001 | P0 | 四种输入组合 | ①文本+文本 ②文件+文件 ③简历文本+JD 文件 ④简历文件+JD 文本 | 均可成功并展示四 Tab |
| E2E-002 | P0 | HTML 预览质量 | 查看 iframe 与「新标签页打开」 | 排版正常；JD 关键词高亮（橙）；无外链依赖导致的空白 |
| E2E-003 | P0 | 前后端限额一致 | 触发 VAL-003 与 API-013 | 文案语义一致 |
| E2E-004 | P0 | 会话恢复 | SS-001 + SS-002 | 通过 |
| E2E-005 | P0 | 密钥与限流 | SEC-001 + RL-002（生产配置） | 通过 |
| E2E-006 | P1 | 长文档耗时 | 接近上限的简历+JD | 120s 内（`edgeone.json` maxDuration）完成或友好超时提示 |

---

## 10. 手工测试记录模板

```
日期：
测试人：
环境：□ Mock  □ edgeone pages dev  □ 生产
版本/提交：

| 用例 ID | 结果 □通过 □失败 □阻塞 | 备注 |
| --- | --- | --- |
| FE-030 | | |
| ... | | |

阻塞缺陷：
```

---

## 11. 附录：curl 示例

```bash
# 文本 + 文本
curl -sS -X POST "http://localhost:8088/api/optimize" \
  -F "resume_str=张三，3年Java开发..." \
  -F "job_desc=招聘高级Java工程师..."

# 仅简历（应 422）
curl -sS -w "\n%{http_code}\n" -X POST "http://localhost:8088/api/optimize" \
  -F "resume_str=test"

# 带文件
curl -sS -X POST "http://localhost:8088/api/optimize" \
  -F "resume_file=@./samples/resume.pdf;type=application/pdf" \
  -F "jd_file=@./samples/jd.pdf;type=application/pdf"
```

---

## 12. 变更记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-15 | 初版：覆盖 FE / VAL / API / RL / SS / MOCK / SEC / E2E |
