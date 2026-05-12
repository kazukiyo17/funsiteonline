/**
 * EdgeOne Pages Function — generate per-type Open Graph SVG (1200×630).
 * 路径：/og/<pet>/<type>.svg （e.g. /og/cat/INFP.svg）
 *
 * 为什么返回 SVG 而不是 PNG：
 * - 零依赖，EdgeOne Functions 冷启动快
 * - Twitter/Facebook/LinkedIn 抓取 og:image 接受 SVG
 * - 微信/微博等国内平台对 OG 的支持本身有限，主要靠 JSSDK 自定义分享；SVG 不是瓶颈
 * - 如需 PNG 后续可替换为 satori + resvg-wasm
 */

const GRADIENT_START = "#fff8f3";
const GRADIENT_END = "#ffe0b8";
const ACCENT = "#e6ac4c";
const INK = "#3a2408";
const INK_SOFT = "#8c6a38";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function emojiFor(pet) {
  return { cat: "🐱", dog: "🐶", parrot: "🦜" }[pet] || "🐾";
}

async function loadData(request) {
  const u = new URL("/data/pets-mbti.json", request.url);
  const r = await fetch(u.toString(), { cf: { cacheTtl: 3600 } });
  if (!r.ok) return null;
  return r.json();
}

export async function onRequest(context) {
  const { request, params } = context;
  const pet = params?.pet;
  const typeRaw = params?.type || "";
  const type = typeRaw.replace(/\.svg$/i, "").toUpperCase();

  const data = await loadData(request);
  const title = data?.results?.titles?.[pet]?.[type];
  const petLabel = data?.questions?.[pet]?.petLabel || "";

  if (!title || !petLabel) {
    return new Response("Not Found", { status: 404 });
  }

  const emoji = emojiFor(pet);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GRADIENT_START}"/>
      <stop offset="100%" stop-color="${GRADIENT_END}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#halo)"/>

  <!-- decorative paws -->
  <g fill="${ACCENT}" opacity="0.18">
    <circle cx="120" cy="120" r="22"/>
    <circle cx="96" cy="160" r="14"/>
    <circle cx="148" cy="160" r="14"/>
    <ellipse cx="122" cy="196" rx="32" ry="22"/>
  </g>
  <g fill="${ACCENT}" opacity="0.14">
    <circle cx="1080" cy="500" r="22"/>
    <circle cx="1056" cy="540" r="14"/>
    <circle cx="1108" cy="540" r="14"/>
    <ellipse cx="1082" cy="576" rx="32" ry="22"/>
  </g>

  <!-- rounded card -->
  <rect x="80" y="80" width="1040" height="470" rx="40" ry="40"
        fill="#ffffff" opacity="0.72"
        stroke="${ACCENT}" stroke-opacity="0.35" stroke-width="3"/>

  <!-- emoji + MBTI code -->
  <text x="600" y="240" text-anchor="middle"
        font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"
        font-size="140">${emoji}</text>

  <text x="600" y="360" text-anchor="middle"
        font-family="'Fredoka','Nunito','PingFang SC','Noto Sans SC',sans-serif"
        font-size="110" font-weight="700"
        letter-spacing="10" fill="${INK}">${escapeXml(type)}</text>

  <!-- title -->
  <text x="600" y="440" text-anchor="middle"
        font-family="'Nunito','PingFang SC','Noto Sans SC',sans-serif"
        font-size="54" font-weight="600" fill="${INK}">${escapeXml(title)}</text>

  <!-- subtitle -->
  <text x="600" y="492" text-anchor="middle"
        font-family="'Nunito','PingFang SC','Noto Sans SC',sans-serif"
        font-size="28" fill="${INK_SOFT}">萌宠 MBTI · ${escapeXml(petLabel)} 专属人格</text>

  <!-- footer brand -->
  <text x="600" y="595" text-anchor="middle"
        font-family="'Outfit','DM Sans',sans-serif"
        font-size="22" font-weight="600" fill="${ACCENT}" letter-spacing="3">
    petsmbti.funsite.online
  </text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
