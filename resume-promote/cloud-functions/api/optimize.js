/**
 * Pages Functions · Cloud Functions（Node.js）
 * 路由：POST /api/optimize（与 cloud-functions/api/optimize.js 对应）
 *
 * 为何不用 Edge Functions：边缘函数单次 CPU 约 200ms、请求体约 1MB，不适合多轮 LLM 工作流。
 */

import { checkRateLimit } from "./rate-limit.js";

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

const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_RESUME_TEXT = 2800;
const DEFAULT_MAX_JD_TEXT = 1000;
const DEFAULT_MAX_REQUEST_BYTES = 12 * 1024 * 1024;

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function parsePositiveInt(value, fallback) {
  if (value == null || value === "") return fallback;
  const n =
    typeof value === "number" ? value : parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * @param {Record<string, string | undefined>} env
 */
function getPayloadLimits(env) {
  return {
    maxFileBytes: parsePositiveInt(env.MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES),
    maxResumeText: parsePositiveInt(
      env.MAX_RESUME_TEXT_CHARS,
      DEFAULT_MAX_RESUME_TEXT,
    ),
    maxJdText: parsePositiveInt(env.MAX_JD_TEXT_CHARS, DEFAULT_MAX_JD_TEXT),
    maxRequestBytes: parsePositiveInt(
      env.MAX_REQUEST_BYTES,
      DEFAULT_MAX_REQUEST_BYTES,
    ),
  };
}

/**
 * @param {number} bytes
 */
function formatFileLimit(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb % 1 === 0 ? `${mb}MB` : `${mb.toFixed(1)}MB`;
}

/**
 * @param {string} name
 * @returns {string} 含点的后缀小写，如 `.pdf`；无后缀则 `""`
 */
function fileExtensionLower(name) {
  const base = name.trim().split(/[/\\]/).pop() || "";
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i).toLowerCase() : "";
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
]);
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);

/**
 * @param {string} mime
 */
function isDocumentMime(mime) {
  return (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-word.document.macroenabled.12"
  );
}

/**
 * 部分运行时 multipart 不带文件名 / 将图片标为 octet-stream，用文件头兜底。
 * @param {Blob} blob
 * @returns {Promise<"document" | "image" | null>}
 */
async function sniffBlobKind(blob) {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return "image";
  }
  if (head.length >= 3 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) {
    return "image";
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image";
  }
  if (
    head.length >= 4 &&
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46
  ) {
    return "document";
  }
  if (head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b) {
    return "document";
  }
  return null;
}

/**
 * Dify 工作流文件变量要求 `type` 与真实类型一致；图片误标为 document 会报 Unsupported Extension Type: .jpg
 * @param {Blob} blob
 * @param {string} [filename]
 * @returns {Promise<"document" | "image">}
 */
async function inferDifyWorkflowFileType(blob, filename = "") {
  const mime = (blob.type || "").trim().toLowerCase();
  const ext = fileExtensionLower(filename);

  if (mime.startsWith("image/")) return "image";
  if (isDocumentMime(mime)) return "document";
  if (ext && IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext && DOCUMENT_EXTENSIONS.has(ext)) return "document";

  const sniffed = await sniffBlobKind(blob);
  if (sniffed) return sniffed;

  return "document";
}

/**
 * @param {Blob} blob
 * @param {string} filename
 * @param {"document" | "image"} workflowType
 */
function ensureUploadFilename(blob, filename, workflowType) {
  const trimmed = filename.trim();
  if (trimmed && fileExtensionLower(trimmed)) return trimmed;

  const mime = (blob.type || "").trim().toLowerCase();
  if (workflowType === "image") {
    if (mime === "image/png") return "upload.png";
    if (mime === "image/gif") return "upload.gif";
    if (mime === "image/webp") return "upload.webp";
    if (mime === "image/svg+xml") return "upload.svg";
    return "upload.jpg";
  }
  if (mime === "application/pdf") return "upload.pdf";
  if (mime === "application/msword") return "upload.doc";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "upload.docx";
  }
  return "upload.pdf";
}

/**
 * @param {FormData} form
 * @param {string} field
 * @param {Blob} blob
 */
function resolveUploadFilename(form, field, blob) {
  const fromForm = String(form.get(`${field}_name`) || "").trim();
  if (fromForm) return fromForm;
  return blobFilenameHint(blob);
}

/**
 * @param {Blob} blob
 * @param {string} [filename]
 */
function isAllowedUploadFile(blob, filename = "") {
  const mime = (blob.type || "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;

  const isDocumentMime =
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-word.document.macroenabled.12";

  if (isDocumentMime) return true;

  const ext = fileExtensionLower(filename || blobFilenameHint(blob));
  const imageExts = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".svg",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
  ]);
  const docExts = new Set([".pdf", ".doc", ".docx"]);

  if (ext && imageExts.has(ext)) return true;
  if (ext && docExts.has(ext)) return true;
  return false;
}

/**
 * @param {Blob} file
 * @returns {string}
 */
function blobFilenameHint(file) {
  if (file && typeof file === "object") {
    const name = /** @type {{ name?: string }} */ (file).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return "";
}

/**
 * @param {string} msg
 */
function friendlyDifyWorkflowError(msg) {
  if (!/Unsupported Extension Type:\s*\.(jpe?g|png|gif|webp|bmp|svg|heic)/i.test(msg)) {
    return msg;
  }
  return (
    "图片被当作文档处理导致失败。请在 Dify 工作流「开始」节点为对应文件变量勾选「图片」类型，" +
    "并对图片走支持视觉的多模态 LLM，勿将图片接入「文档提取器」。若已通过 API 上传，请确认后端传入 type 为 image。"
  );
}

/**
 * @param {{
 *   resumeText: string,
 *   jdText: string,
 *   resumeFile: unknown,
 *   jdFile: unknown,
 * }} payload
 * @param {ReturnType<typeof getPayloadLimits>} limits
 */
function validatePayload(payload, limits) {
  const { resumeText, jdText, resumeFile, jdFile } = payload;

  if (resumeText.length > limits.maxResumeText) {
    return {
      code: "RESUME_TEXT_TOO_LONG",
      message: `简历文本不超过 ${limits.maxResumeText} 字（当前 ${resumeText.length} 字）。`,
      status: 422,
    };
  }
  if (jdText.length > limits.maxJdText) {
    return {
      code: "JD_TEXT_TOO_LONG",
      message: `JD 文本不超过 ${limits.maxJdText} 字（当前 ${jdText.length} 字）。`,
      status: 422,
    };
  }
  if (isNonEmptyBlob(resumeFile) && resumeFile.size > limits.maxFileBytes) {
    return {
      code: "RESUME_FILE_TOO_LARGE",
      message: `简历文件不超过 ${formatFileLimit(limits.maxFileBytes)}。`,
      status: 413,
    };
  }
  if (isNonEmptyBlob(jdFile) && jdFile.size > limits.maxFileBytes) {
    return {
      code: "JD_FILE_TOO_LARGE",
      message: `JD 文件不超过 ${formatFileLimit(limits.maxFileBytes)}。`,
      status: 413,
    };
  }
  if (
    isNonEmptyBlob(resumeFile) &&
    !isAllowedUploadFile(
      resumeFile,
      blobFilenameHint(/** @type {Blob} */ (resumeFile)),
    )
  ) {
    return {
      code: "UNSUPPORTED_RESUME_FILE",
      message: "简历文件仅支持 PDF、Word 或常见图片格式。",
      status: 422,
    };
  }
  if (
    isNonEmptyBlob(jdFile) &&
    !isAllowedUploadFile(jdFile, blobFilenameHint(/** @type {Blob} */ (jdFile)))
  ) {
    return {
      code: "UNSUPPORTED_JD_FILE",
      message: "JD 文件仅支持 PDF、Word 或常见图片格式。",
      status: 422,
    };
  }

  const total =
    resumeText.length +
    jdText.length +
    (isNonEmptyBlob(resumeFile) ? resumeFile.size : 0) +
    (isNonEmptyBlob(jdFile) ? jdFile.size : 0);
  if (total > limits.maxRequestBytes) {
    return {
      code: "PAYLOAD_TOO_LARGE",
      message: "本次提交内容过大，请缩小文件或精简文本后重试。",
      status: 413,
    };
  }

  return null;
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
  const name = filename || blobFilenameHint(file) || "upload.bin";
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
  const kText = env.DIFY_OUTPUT_TEXT || "resume_text";
  const kHtml = env.DIFY_OUTPUT_HTML || "resume_html";
  const kTips = env.DIFY_OUTPUT_SUGGESTIONS || "suggestions";
  const kAnalysis = env.DIFY_OUTPUT_ANALYSIS || "analyse";
  const kMatch = env.DIFY_OUTPUT_MATCH || "matchScore";
  const kChange =
    env.DIFY_OUTPUT_CHANGELOG || "modificationPoints";

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
    analysis: pick(kAnalysis),
    modificationPoints: pick(kChange),
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

  const rate = await checkRateLimit(request, env);
  if (!rate.allowed) {
    return jsonBody(
      429,
      {
        error: {
          code: rate.code || "RATE_LIMIT_EXCEEDED",
          message: rate.message,
        },
      },
      env,
      { "Retry-After": String(rate.retryAfterSec) },
    );
  }

  const limits = getPayloadLimits(env);
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const len = parseInt(contentLength, 10);
    if (Number.isFinite(len) && len > limits.maxRequestBytes) {
      return jsonBody(
        413,
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "本次提交内容过大，请缩小文件或精简文本后重试。",
          },
        },
        env,
      );
    }
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

  const limitError = validatePayload(
    { resumeText, jdText, resumeFile, jdFile },
    limits,
  );
  if (limitError) {
    return jsonBody(
      limitError.status,
      {
        error: {
          code: limitError.code,
          message: limitError.message,
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
      const resumeBlob = /** @type {Blob} */ (resumeFile);
      const resumeName = resolveUploadFilename(form, "resume_file", resumeBlob);
      const resumeType = await inferDifyWorkflowFileType(
        resumeBlob,
        resumeName,
      );
      const uploadName = ensureUploadFilename(
        resumeBlob,
        resumeName,
        resumeType,
      );
      const id = await difyUploadFile(
        baseUrl,
        apiKey,
        resumeBlob,
        user,
        uploadName,
      );
      inputs[ikResumeFile] = {
        transfer_method: "local_file",
        upload_file_id: id,
        type: resumeType,
      };
    }
    if (isNonEmptyBlob(jdFile)) {
      const jdBlob = /** @type {Blob} */ (jdFile);
      const jdName = resolveUploadFilename(form, "jd_file", jdBlob);
      const jdType = await inferDifyWorkflowFileType(jdBlob, jdName);
      const uploadName = ensureUploadFilename(jdBlob, jdName, jdType);
      const id = await difyUploadFile(
        baseUrl,
        apiKey,
        jdBlob,
        user,
        uploadName,
      );
      inputs[ikJdFile] = {
        transfer_method: "local_file",
        upload_file_id: id,
        type: jdType,
      };
    }

    const wf = await difyRunWorkflow(baseUrl, apiKey, inputs, user);

    const dataBlock = wf.data ?? wf;
    const status = dataBlock.status ?? wf.status;
    if (status && status !== "succeeded") {
      const errMsg = friendlyDifyWorkflowError(
        String(
          dataBlock.error ||
            wf.error ||
            (typeof dataBlock.outputs === "object" &&
              dataBlock.outputs?.error) ||
            `工作流未成功：${status}`,
        ),
      );
      return jsonBody(
        502,
        { error: { code: "WORKFLOW_FAILED", message: errMsg } },
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
    const msg = friendlyDifyWorkflowError(
      e instanceof Error ? e.message : String(e),
    );
    const status = e && typeof e === "object" && "status" in e ? e.status : 502;
    const httpStatus = typeof status === "number" ? status : 502;
    return jsonBody(
      httpStatus,
      { error: { code: "UPSTREAM_ERROR", message: msg } },
      env,
    );
  }
}
