/**
 * Pages Functions · Cloud Functions（Node.js）
 * 路由：POST /api/optimize（与 cloud-functions/api/optimize.js 对应）
 *
 * 为何不用 Edge Functions：边缘函数单次 CPU 约 200ms、请求体约 1MB，不适合多轮 LLM 工作流。
 */

const JSON_HEADERS = { "Content-Type": "application/json; charset=UTF-8" };

function corsHeaders(env) {
  const origin = env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonBody(status, payload, env, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(env), ...extraHeaders },
  });
}

/** @param {unknown} r */
function safeJsonParse(r) {
  if (typeof r !== "string") return null;
  try {
    return JSON.parse(r);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} file
 * @returns {file is Blob}
 */
function isNonEmptyBlob(file) {
  return (
    file != null &&
    typeof file === "object" &&
    typeof (/** @type {Blob} */ (file)).size === "number" &&
    (/** @type {Blob} */ (file)).size > 0 &&
    typeof (/** @type {Blob} */ (file)).arrayBuffer === "function"
  );
}

/**
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {Blob} file
 * @param {string} user
 * @param {string} [filename]
 */
async function difyUploadFile(baseUrl, apiKey, file, user, filename) {
  const fd = new FormData();
  const name =
    filename ||
    (typeof File !== "undefined" && file instanceof File && file.name) ||
    "document.bin";
  fd.append("file", file, name);
  fd.append("user", user);

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });

  const raw = await res.text();
  const data = safeJsonParse(raw) ?? {};

  if (!res.ok) {
    const msg =
      data.message ||
      data.error ||
      data.detail ||
      raw.slice(0, 200) ||
      `files/upload ${res.status}`;
    throw new Error(msg);
  }

  const id = data.id;
  if (!id) throw new Error("Dify 上传未返回文件 id");
  return id;
}

/**
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {Record<string, unknown>} inputs
 * @param {string} user
 */
async function difyRunWorkflow(baseUrl, apiKey, inputs, user) {
  console.log('difyRunWorkflow', baseUrl, apiKey, inputs, user);
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/workflows/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs,
      response_mode: "blocking",
      user,
    }),
  });

  const raw = await res.text();
  const parsed = safeJsonParse(raw);

  console.log('dify workflow parsed', JSON.stringify(parsed, null, 2));

  if (!res.ok) {
    const msg =
      parsed?.message ||
      parsed?.error ||
      parsed?.detail ||
      raw.slice(0, 400) ||
      `workflows/run ${res.status}`;
    const err = new Error(msg);
    err.status = res.status >= 500 ? 502 : res.status === 429 ? 429 : 422;
    throw err;
  }

  return parsed ?? {};
}

/**
 * @param {Record<string, unknown>} outputs
 * @param {Record<string, string | undefined>} env
 */
function mapOutputs(outputs, env) {
  const kText = env.DIFY_OUTPUT_TEXT || "optimizedText";
  const kHtml = env.DIFY_OUTPUT_HTML || "html";
  const kTips = env.DIFY_OUTPUT_SUGGESTIONS || "suggestions";
  const kMatch = env.DIFY_OUTPUT_MATCH || "matchScore";

  const pick = (key) => {
    const v = outputs[key];
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  let matchScore = outputs[kMatch];
  if (typeof matchScore === "string") {
    const n = parseFloat(matchScore);
    matchScore = Number.isFinite(n) ? n : matchScore;
  }
  if (typeof matchScore !== "number") {
    const m = String(pick(kMatch) || "").match(/(\d{1,3})\s*%/);
    matchScore = m ? Number(m[1]) : undefined;
  }

  return {
    matchScore,
    optimizedText: pick(kText),
    html: pick(kHtml),
    suggestions: pick(kTips),
  };
}

export function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.env),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.DIFY_API_KEY;
  const baseUrl = (env.DIFY_API_URL || "https://api.dify.ai").replace(/\/$/, "");

  if (!apiKey) {
    return jsonBody(
      500,
      {
        error: {
          code: "MISSING_DIFY_API_KEY",
          message: "服务端未配置 DIFY_API_KEY，请在 Pages 环境变量中设置。",
        },
      },
      env,
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonBody(
      400,
      { error: { code: "BAD_MULTIPART", message: "无法解析表单数据。" } },
      env,
    );
  }

  const resumeText = String(form.get("resume_str") || "").trim();
  const jdText = String(form.get("job_desc") || "").trim();
  const resumeFile = form.get("resume_file");
  const jdFile = form.get("jd_file");

  const hasResume = resumeText.length > 0 || isNonEmptyBlob(resumeFile);
  const hasJd = jdText.length > 0 || isNonEmptyBlob(jdFile);

  if (!hasResume) {
    return jsonBody(
      422,
      {
        error: {
          code: "MISSING_RESUME",
          message: "请至少提供简历文件或简历文本。",
        },
      },
      env,
    );
  }
  if (!hasJd) {
    return jsonBody(
      422,
      {
        error: {
          code: "MISSING_JD",
          message: "请至少提供 JD 文件或 JD 文本。",
        },
      },
      env,
    );
  }

  const user =
    request.headers.get("x-user-id")?.trim() ||
    env.DIFY_DEFAULT_USER ||
    "resume-promote-web";

  const ikText = env.DIFY_INPUT_RESUME_TEXT || "resume_str";
  const ikJd = env.DIFY_INPUT_JD_TEXT || "job_desc";
  const ikResumeFile = env.DIFY_INPUT_RESUME_FILE || "resume_file";
  const ikJdFile = env.DIFY_INPUT_JD_FILE || "jd_file";

  /** @type {Record<string, unknown>} */
  const inputs = {};

  if (resumeText) inputs[ikText] = resumeText;
  if (jdText) inputs[ikJd] = jdText;

  try {
    if (isNonEmptyBlob(resumeFile)) {
      const id = await difyUploadFile(
        baseUrl,
        apiKey,
        /** @type {Blob} */ (resumeFile),
        user,
        typeof File !== "undefined" &&
          resumeFile instanceof File &&
          resumeFile.name
          ? resumeFile.name
          : undefined,
      );
      inputs[ikResumeFile] = {
        transfer_method: "local_file",
        upload_file_id: id,
        type: "document",
      };
    }
    if (isNonEmptyBlob(jdFile)) {
      const id = await difyUploadFile(
        baseUrl,
        apiKey,
        /** @type {Blob} */ (jdFile),
        user,
        typeof File !== "undefined" && jdFile instanceof File && jdFile.name
          ? jdFile.name
          : undefined,
      );
      inputs[ikJdFile] = {
        transfer_method: "local_file",
        upload_file_id: id,
        type: "document",
      };
    }

    const wf = await difyRunWorkflow(baseUrl, apiKey, inputs, user);

    const dataBlock = wf.data ?? wf;
    const status = dataBlock.status ?? wf.status;
    if (status && status !== "succeeded") {
      const errMsg =
        dataBlock.error ||
        wf.error ||
        (typeof dataBlock.outputs === "object" &&
          dataBlock.outputs?.error) ||
        `工作流未成功：${status}`;
      return jsonBody(
        502,
        { error: { code: "WORKFLOW_FAILED", message: String(errMsg) } },
        env,
      );
    }

    const outputs =
      (typeof dataBlock.outputs === "object" && dataBlock.outputs) ||
      (typeof wf.outputs === "object" && wf.outputs) ||
      {};

    const mapped = mapOutputs(outputs, env);
    const requestId =
      wf.workflow_run_id ||
      dataBlock.id ||
      wf.task_id ||
      context.server?.requestId ||
      "";

    return jsonBody(
      200,
      {
        ...mapped,
        meta: { requestId },
      },
      env,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = e && typeof e === "object" && "status" in e ? e.status : 502;
    const httpStatus = typeof status === "number" ? status : 502;
    return jsonBody(
      httpStatus,
      { error: { code: "UPSTREAM_ERROR", message: msg } },
      env,
    );
  }
}
