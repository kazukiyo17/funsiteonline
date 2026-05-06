/**
 * 统计页拉取 KV 汇总 → GET /api/petsmbti/stats
 * 返回 Promise，resolve { ok, data }
 */
(function (global) {
  var STATS_PATH = "/api/petsmbti/stats";

  global.fetchPetsmbtiStats = function fetchPetsmbtiStats() {
    return fetch(STATS_PATH).then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, data: data };
      });
    });
  };
})(typeof window !== "undefined" ? window : this);
