/**
 * EdgeOne Pages Function — inject per-type SEO meta into result.html.
 *
 * Path: /result.html?pet=cat&type=INFP
 * 静态 result.html 的 <head> 里已预置了占位 meta/ld+json；此函数按 URL 参数
 * 从同源 /data/pets-mbti.json 读取 petLabel/title/blurb，再用 HTMLRewriter
 * 改写 <head> 里的对应 meta 与 <title>，使爬虫与社交卡片抓取拿到正确内容。
 */

import { buildMeta, rewriteHead } from "./_lib/seo.js";

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const pet = url.searchParams.get("pet");
  const type = url.searchParams.get("type");

  const res = await next(); // 拉取静态 result.html

  if (!pet || !type) return res;

  const meta = await buildMeta({ request, pet, type, page: "result" });
  if (!meta) return res;

  return rewriteHead(res, meta);
}
