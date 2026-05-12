/**
 * GET /api/petsmbti/stats — 路由入口（实现：petsmbti/kv/stats.js）
 * 与仅发布 petsmbti/ 目录的 EdgeOne Pages 部署对齐：functions 位于站点根下。
 */
export { onRequestGet } from "../../../kv/stats.js";
