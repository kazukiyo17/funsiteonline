/** 与 POST /api/optimize 成功响应字段对齐，仅供本地联调 UI */

export function getMockOptimizeResponse() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>简历 · Mock</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #0f172a; line-height: 1.6; }
    h1 { font-size: 1.35rem; border-bottom: 2px solid #3b82f6; padding-bottom: 0.35rem; }
    .tag { color: #64748b; font-size: 0.9rem; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <p class="tag">本地 MOCK — 非真实接口返回</p>
  <h1>张小拾 · 前端开发</h1>
  <p>示例邮箱 mock@example.com · 示例城市</p>
  <h2>工作经历</h2>
  <ul>
    <li>某公司 · 前端 · 负责 Web 应用交付与性能优化（mock）</li>
  </ul>
  <h2>技能</h2>
  <p>JavaScript / HTML / CSS · 协作与文档（mock）</p>
</body>
</html>`;

  return {
    matchScore: 82,
    optimizedText:
      "张小拾\n前端开发\n…（mock 纯文本简历，真实环境由 Dify 填充）",
    html,
    suggestions: `## 结构建议（mock）

- 用 **STAR** 描述项目：情境 → 任务 → 行动 → 结果
- 关键字与目标 **JD** 对齐，避免泛泛的「负责开发」

### 篇幅

控制在一页内，模块顺序：个人信息 → 核心技能 → 经历 → 教育。

> 以上为本地 mock 的 Markdown 示例，线上由工作流返回真实内容。
`,
    meta: { requestId: "mock-local-" + Date.now() },
  };
}
