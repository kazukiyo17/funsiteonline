/**
 * @param {HTMLIFrameElement} iframe
 * @param {string} [html]
 */
export function setPreviewHtml(iframe, html) {
  if (!iframe) return;
  iframe.srcdoc = html && html.trim() ? html : "";
}
