/**
 * POST /api/petsmbti/complete — 路由入口（实现：petsmbti/kv/track.js）
 * 与仅发布 petsmbti/ 目录的 EdgeOne Pages 部署对齐：functions 位于站点根下。
 */
import { runPetsmbtiComplete, corsOptionsPost } from "../../../kv/track.js";

export async function onRequestPost(context) {
  return runPetsmbtiComplete(context, null);
}

export function onRequestOptions() {
  return corsOptionsPost();
}
