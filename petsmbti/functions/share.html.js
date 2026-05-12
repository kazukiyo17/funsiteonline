/**
 * EdgeOne Pages Function — inject per-type SEO meta into share.html.
 * 与 result.html.js 同理，读取 ?pet=&type= 后改写 <head>。
 */

import { buildMeta, rewriteHead } from "./_lib/seo.js";

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const pet = url.searchParams.get("pet");
  const type = url.searchParams.get("type");

  const res = await next();

  if (!pet || !type) return res;

  const meta = await buildMeta({ request, pet, type, page: "share" });
  if (!meta) return res;

  return rewriteHead(res, meta);
}
