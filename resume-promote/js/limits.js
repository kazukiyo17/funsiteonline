/** @typedef {{ maxFileBytes: number, maxResumeText: number, maxJdText: number, maxRequestBytes: number }} PayloadLimits */

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
 * @param {Record<string, unknown>} [source]
 * @returns {PayloadLimits}
 */
function resolveLimits(source) {
  const env = source ?? {};
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

/** @returns {PayloadLimits} */
export function getLimits() {
  const env =
    typeof window !== "undefined" && window.__ENV__ ? window.__ENV__ : {};
  return resolveLimits(env);
}

/**
 * @param {number} bytes
 */
export function formatFileLimit(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb % 1 === 0 ? `${mb}MB` : `${mb.toFixed(1)}MB`;
}

/**
 * @param {number} current
 * @param {number} max
 */
export function formatCharCount(current, max) {
  return `${current.toLocaleString()} / ${max.toLocaleString()} 字`;
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
 * @param {string} name
 */
function fileExtensionLower(name) {
  const base = name.trim().split(/[/\\]/).pop() || "";
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i).toLowerCase() : "";
}

/**
 * @param {File | Blob} file
 * @param {string} [filename]
 */
export function isAllowedUploadFile(file, filename = "") {
  if (!file || file.size === 0) return false;
  const name =
    filename ||
    (typeof File !== "undefined" && file instanceof File && file.name) ||
    "";
  const mime = (file.type || "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-word.document.macroenabled.12"
  ) {
    return true;
  }
  const ext = fileExtensionLower(name);
  if (ext && IMAGE_EXTENSIONS.has(ext)) return true;
  if (ext && DOCUMENT_EXTENSIONS.has(ext)) return true;
  return false;
}

export function uploadFileRejectMessage() {
  return "仅支持 PDF、Word 或常见图片（PNG、JPG、WebP、HEIC 等）。";
}

/**
 * @param {PayloadLimits} limits
 */
export function formatLimitHints(limits) {
  return {
    file: `PDF、Word、图片，单文件 ≤ ${formatFileLimit(limits.maxFileBytes)}`,
    resumeText: `简历文本 ≤ ${limits.maxResumeText.toLocaleString()} 字`,
    jdText: `JD 文本 ≤ ${limits.maxJdText.toLocaleString()} 字`,
  };
}

/**
 * @param {{ resumeText: string, jdText: string, resumeFile: File | null, jdFile: File | null }} payload
 * @param {PayloadLimits} limits
 * @returns {{ code: string, message: string, status: number } | null}
 */
export function validateOptimizePayload(payload, limits) {
  const { resumeText, jdText, resumeFile, jdFile } = payload;

  if (resumeText.length > limits.maxResumeText) {
    return {
      code: "RESUME_TEXT_TOO_LONG",
      message: `简历文本不超过 ${limits.maxResumeText.toLocaleString()} 字（当前 ${resumeText.length.toLocaleString()} 字）。`,
      status: 422,
    };
  }
  if (jdText.length > limits.maxJdText) {
    return {
      code: "JD_TEXT_TOO_LONG",
      message: `JD 文本不超过 ${limits.maxJdText.toLocaleString()} 字（当前 ${jdText.length.toLocaleString()} 字）。`,
      status: 422,
    };
  }
  if (resumeFile && resumeFile.size > limits.maxFileBytes) {
    return {
      code: "RESUME_FILE_TOO_LARGE",
      message: `简历文件不超过 ${formatFileLimit(limits.maxFileBytes)}。`,
      status: 413,
    };
  }
  if (jdFile && jdFile.size > limits.maxFileBytes) {
    return {
      code: "JD_FILE_TOO_LARGE",
      message: `JD 文件不超过 ${formatFileLimit(limits.maxFileBytes)}。`,
      status: 413,
    };
  }

  const total =
    resumeText.length +
    jdText.length +
    (resumeFile?.size ?? 0) +
    (jdFile?.size ?? 0);
  if (total > limits.maxRequestBytes) {
    return {
      code: "PAYLOAD_TOO_LARGE",
      message: "本次提交内容过大，请缩小文件或精简文本后重试。",
      status: 413,
    };
  }

  return null;
}
