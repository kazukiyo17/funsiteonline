# 参赛视频脚本 · 职配星 JobMatchStar（Dify × EdgeOne）

本文档用于参加 [Dify × EdgeOne 最佳实践征集大赛](https://cloud.tencent.com/developer/article/2665784?from=eogroups) 的视频作品，叙事主线对齐赛题：**EdgeOne Pages 托管与函数** × **Dify Workflow 编排** × **前后端与工作流的对接**。含分镜、录屏清单、AI 画面 Prompt、旁白口播稿。项目说明见 [README.md](../README.md)、[design.md](./design.md)。**EdgeOne / Dify 具体用到哪些能力**（口播可查表）见 **[edgeone-dify-features.md](./edgeone-dify-features.md)**。

---

## 1. 视频定位与参数建议

| 项 | 建议 |
| --- | --- |
| 时长 | **90～180 秒**（比赛常见要求；若平台限 3 分钟以内，优先 2 分钟内） |
| 画幅 | **16:9 横屏**（便于 B 站/视频号/腾讯云社区） |
| 结构 | **场景（10s）→ EdgeOne + Dify 怎么接（20s）→ 产品演示（45s）→ 对接细节与上线（25s）→ 赛题 CTA（5s）** |
| 声音 | 旁白 + 轻量 BGM（-12～-16 LUFS 底噪勿过大） |
| 合规 | 演示用**脱敏简历/JD**；勿露出真实 `DIFY_API_KEY`、`.env` 全文 |

---

## 2. 分镜总表（按时间轴）

| 镜号 | 时长 | 画面来源 | 旁白段落 |
| --- | --- | --- | --- |
| A | 0:00–0:10 | AI 生成 + 可选实拍 | §3.1 |
| B | 0:10–0:30 | AI 生成 + 可选 Dify/EdgeOne 录屏 | §3.2 |
| C | 0:30–1:15 | **录屏**（主） | §3.3 |
| D | 1:15–1:40 | **录屏**（对接/配置）+ AI 点缀 | §3.4 |
| E | 1:40–1:50 | AI 生成 / 架构图 | §3.5 |
| F | 1:50–1:58 | 产品页 + 赛题文案卡 | §3.6 |

可根据总时长按比例压缩 C 段演示。

---

## 3. 旁白口播稿（可直接照读 · 赛题向：EdgeOne + Dify + 对接）

语速可以略快一点：**240～260 字/分钟**更有节奏。括号内为语气提示，不必读出。

### §3.1 开场（镜 A）

> JD 写得明明白白，简历还在「万能模板」里打转？（停顿半拍）匹配不上，再投也是白投。  
> 这是我参赛用的 **职配星 JobMatchStar**：把简历和目标 JD 丢进去，背后跑的是 **Dify 工作流**；页面上直接给你 **HTML 预览** 和 **Markdown 建议**，主打一个「改完就能用」。

### §3.2 赛题对齐：EdgeOne Pages + Dify，怎么接（镜 B）

> 这套玩法，就是赛题里说的 **Dify × EdgeOne**：**Dify** 里把「读简历、读 JD、优化、出 HTML、写建议」拆成 **Workflow** 一串节点；**EdgeOne Pages** 一边托管静态页，一边用 **Cloud Functions** 扛 `POST /api/optimize`。  
> **对接**很简单：浏览器把简历和 JD 用 `multipart/form-data` 丢给同源接口；函数里把文本塞进工作流 `inputs`，文件先走 Dify 的 **upload**，再带上 `upload_file_id` 去 **`workflows/run`（blocking）**；返回的 `outputs` 映射成前端的 HTML、Markdown 字段——编排归 Dify，发布与算力归 EdgeOne，一条链路打通。

### §3.3 产品演示：工作流结果怎么呈现（镜 C）

> 页面上：简历、JD **可粘贴可上传**，点「开跑优化」就是在触发刚才那条 **EdgeOne → Dify** 链路。  
> 跑完给你四个 Tab，对应工作流吐出的不同产物：**导出简历** 用 iframe 直接预览模型生成的 **HTML**；**优化简历 / 简历分析 / 提升建议** 走 Markdown 渲染——等于把 Dify 各节点输出，一次性铺开展示。  
> 需要带走？**新标签页打开** HTML，另存或转发都行。

### §3.4 对接与上线：EdgeOne 侧还能做什么（镜 D）

> **对接**不止「能调通」：`edgeone.json` 里把函数超时拉长，匹配 Dify **blocking** 这种长任务；环境变量里把工作流 **inputs/outputs 变量名** 和后端映射对齐，改 Dify 节点也不用大改前端。  
> 同一套 Pages 项目里可开 **KV 限流**，给 `/api/optimize` 和上游工作流挡流量尖峰。  
> 本地用 **`edgeone pages dev`** 同源联调；想先拍视频、不调真工作流，就切 **Mock**，静态 UI 照样演示链路。

### §3.5 架构收束：赛题一句话（镜 E）

> 收个尾：**EdgeOne Pages** 负责「页面全球可达 + 函数跑对接逻辑」；**Dify** 负责「工作流编排与多步 LLM」；中间这层 **Cloud Function** 把 **multipart、文件上传、工作流入参/出参映射** 全部接住。  
> 这就是 **Dify × EdgeOne**：**一个管 AI 流水线，一个管发布与运行**——从想法到可点的产品，路径最短。

### §3.6 结尾 CTA（镜 F）

> 完整对接说明和目录在 **`resume-promote`**，欢迎当模板二创。  
> 这条片子也投 **Dify × EdgeOne 最佳实践征集**——用 **Pages + Functions + Dify Workflow** 讲清楚「怎么接、怎么上线」。活动链接见简介，来玩同款组合。

---

## 4. 你需要录的屏幕素材（清单）

录制建议：**1080p 及以上**、**60fps 可选**、浏览器 **100% 缩放**、隐藏书签栏与无关插件；用**脱敏**简历与 JD。

| 序号 | 素材内容 | 操作步骤 | 建议时长 |
| --- | --- | --- | --- |
| R1 | 首页完整首屏 | 打开 JobMatchStar 首页，缓慢滚动到表单区 | 3～5 s |
| R2 | 填写简历文本 | 在简历框粘贴一段脱敏简历，字数提示变化 | 5～8 s |
| R3 | 填写 JD 文本 | 在 JD 框粘贴脱敏 JD | 5～8 s |
| R4 | 上传简历文件 | 点击选择文件或拖入 PDF/Word，出现文件名徽章 | 5～8 s |
| R5 | 提交与加载态 | 点击「开跑优化」，展示加载文案与禁用按钮 | 5～10 s |
| R6 | 结果区 Tab 切换 | 依次切换：导出简历 → 优化简历 → 简历分析 → 提升建议 | 15～25 s |
| R7 | HTML iframe 预览 | 在「导出简历」Tab 内展示 iframe 内排版（可轻微滚动 iframe 内页面） | 8～12 s |
| R8 | 新标签页打开 | 点击「在新标签页打开」，展示新窗口 HTML | 5～8 s |
| R9 | 校验提示（可选） | 故意只填 JD 不填简历，提交，展示 `#form-hint` 提示 | 5 s |
| R10 | Mock 模式（可选） | `MOCK_OPTIMIZE=true` 后刷新，快速出结果，体现本地 UI 调试 | 8～12 s |
| R11 | 对接代码一瞥（推荐） | VS Code 打开 `cloud-functions/api/optimize.js`：快速扫到 `formData`、`files/upload`、`workflows/run` 或 `mapOutputs` 片段（勿展示敏感配置） | 10～15 s |
| R12 | EdgeOne / Dify（可选） | 控制台 Pages 环境变量界面打码录 2～3 秒；Dify 工作流画布广角 3～5 秒 | 各 3～5 s |

**剪辑提示**：R5 若真实 API 较慢，可中间剪一刀接「已成功」画面，旁白连续即可。

---

## 5. AI 生成视频 / 画面 Prompt（按镜）

以下 Prompt 适用于 **文生视频** 或 **图生视频** 工具（可先生关键帧图再图生视频）。统一风格：**现代科技、浅色 UI、无具体真人正脸、无商标乱入**。

### 镜 A · 开场情绪

```text
Cinematic 16:9, soft daylight office, young professional silhouette at laptop, floating holographic resume and job description documents merging into light particles, clean minimal tech aesthetic, shallow depth of field, no readable text, no logos, hopeful mood, 4 seconds
```

### 镜 B · EdgeOne × Dify 对接意象

```text
16:9 abstract motion graphics: left side static web layout tiles flowing into center pipeline arrows, right side node-graph workflow blocks pulsing in sequence, globe edge glow suggesting global CDN, glassmorphism, purple-blue gradient, no brand logos, no readable real UI text, smooth camera pan left-to-right, 6 seconds
```

### 镜 E · 架构总结（可作动效底）

```text
16:9 isometric diagram animation: static web page connects to API gateway then serverless function block then AI workflow chip, arrows flowing one direction, glassmorphism style, pastel colors, labels as unreadable pseudo-text only, loopable subtle motion, 8 seconds
```

### 镜 F · 结尾氛围

```text
16:9 wide shot, sunrise over modern city skyline, gentle lens flare, calm inspirational tone, no logos, cinematic color grade, slow dolly forward, 4 seconds
```

**负面提示（可加在各 Prompt 末尾）**

```text
no Tencent logo, no Dify logo, no distorted fingers, no gibberish large text, no celebrity face
```

> 说明：比赛主办方为腾讯云，但 AI 画面**不必强行贴官方 Logo**；口播与简介里文字提及活动与链接即可。活动页：[Dify × EdgeOne 最佳实践征集大赛](https://cloud.tencent.com/developer/article/2665784?from=eogroups)。

---

## 6. 分镜脚本细表（剪辑对照）

| 镜号 | 画面 | 声音 |
| --- | --- | --- |
| A | AI：粒子汇聚简历/JD | §3.1 |
| B | AI：静态页 → 管道 → 工作流节点图；可叠 Dify/EdgeOne 录屏 | §3.2 |
| C | 录屏 R1→R8 剪辑串联 | §3.3 |
| D | 录屏 R12、R11；可选 R9/R10 | §3.4 |
| E | AI 架构动效 或 静态架构图（可自画一帧） | §3.5 |
| F | 产品页定帧 + 活动文案卡（纯文字） | §3.6 |

---

## 7. 简介区可粘贴的短文案（参赛投稿用）

**标题示例**：Dify 工作流 × EdgeOne Pages：简历 + JD 一条链路跑通上线

**简介示例（150 字内 · 赛题向）**：

> 职配星：静态页托管在 **EdgeOne Pages**，`POST /api/optimize` 走 **Cloud Functions**；multipart 进函数，文件 **upload** 后进 **Dify Workflow** `workflows/run`（blocking），outputs 映射为 HTML / Markdown 多 Tab 展示。`edgeone.json` 拉长超时、KV 限流、本地 `pages dev` + Mock 联调。演示脱敏。仓库 `resume-promote`，参赛 [Dify × EdgeOne 征集](https://cloud.tencent.com/developer/article/2665784?from=eogroups)。

---

## 8. 自检清单（上传前）

- [ ] 画面与录屏中勿展示敏感环境变量或完整本地配置
- [ ] 简历/JD 为虚构或脱敏
- [ ] 口播「EdgeOne」「Dify」「Cloud Functions」发音清晰
- [ ] 片尾可加：仓库名 / 作者昵称 / 「作品为参赛原创」
- [ ] 音量：旁白明显大于 BGM

---

## 9. 变更记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-15 | 初版：分镜、录屏清单、AI Prompt、旁白与投稿简介 |
| 2026-05-15 | 口播与简介改为网感版；语速建议微调 |
| 2026-05-15 | 对齐赛题：突出 EdgeOne Pages、Dify Workflow、对接链路；弱化安全向口播；镜 B Prompt 与录屏建议调整 |
