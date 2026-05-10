import { postOptimize } from "./api/client.js";
import { buildOptimizePayload } from "./ui/forms.js";
import { setPreviewHtml } from "./ui/preview.js";
import { renderSuggestionsMarkdown } from "./ui/markdown.js";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function initTabs() {
  const buttons = document.querySelectorAll(".tabs__btn");
  const panels = {
    html: $("tab-html"),
    tips: $("tab-tips"),
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-tab");
      if (!name || !panels[name]) return;

      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });

      Object.entries(panels).forEach(([key, panel]) => {
        const on = key === name;
        panel.classList.toggle("is-active", on);
        panel.hidden = !on;
      });
    });
  });
}

/**
 * @param {string} html
 * @returns {Window | null}
 */
function openHtmlInNewTab(html) {
  const trimmed = (html || "").trim();
  if (!trimmed) return null;
  const blob = new Blob([trimmed], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } else {
    URL.revokeObjectURL(url);
  }
  return win;
}

function main() {
  const form = /** @type {HTMLFormElement} */ ($("form-optimize"));
  const hint = $("form-hint");
  const btnSubmit = $("btn-submit");
  const panelStatus = $("panel-status");
  const panelResults = $("panel-results");
  const outTips = $("out-tips");
  const previewFrame = /** @type {HTMLIFrameElement} */ ($("preview-frame"));

  let abortCtrl = null;
  /** @type {string} */
  let lastResumeHtml = "";

  initTabs();

  $("btn-open-resume-tab").addEventListener("click", () => {
    if (!lastResumeHtml.trim()) {
      hint.textContent = "当前没有可打开的 HTML 简历，请先完成优化。";
      hint.style.color = "var(--danger, #e11d48)";
      return;
    }
    hint.style.color = "";
    openHtmlInNewTab(lastResumeHtml);
  });

  form.addEventListener("reset", () => {
    hint.textContent = "";
    hint.style.color = "";
    panelStatus.className = "panel-status panel-status--hidden";
    panelResults.classList.add("panel-results--hidden");
    lastResumeHtml = "";
    outTips.innerHTML = "";
    setPreviewHtml(previewFrame, "");
    if (abortCtrl) abortCtrl.abort();
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    hint.textContent = "";
    hint.style.color = "";

    const built = buildOptimizePayload(form);
    if (!built.ok) {
      hint.textContent = built.message || "";
      return;
    }

    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();

    panelResults.classList.add("panel-results--hidden");
    panelStatus.className = "panel-status panel-status--loading";
    panelStatus.textContent = "AI 正在加班加点打磨简历，稍等片刻～（长文档可能要一两分钟）";
    btnSubmit.disabled = true;

    try {
      const data = await postOptimize(built.formData, abortCtrl.signal);

      outTips.innerHTML = renderSuggestionsMarkdown(data.suggestions);
      lastResumeHtml = data.html || "";
      setPreviewHtml(previewFrame, lastResumeHtml);

      panelStatus.className = "panel-status panel-status--hidden";
      panelResults.classList.remove("panel-results--hidden");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      panelStatus.className = "panel-status panel-status--error";
      panelStatus.textContent = msg;
    } finally {
      btnSubmit.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", main);
