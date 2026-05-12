/**
 * 问卷完成埋点（前端）→ POST …/api/petsmbti/complete
 * 与 fetch-stats.js 相同：默认 ../api/…；?apiRoot= 覆盖
 */
(function (global) {
  function resolveCompleteUrl() {
    try {
      var u = new URL(global.location.href);
      var root = u.searchParams.get("apiRoot");
      if (root) {
        var base = String(root).replace(/\/?$/, "/");
        return new URL("api/petsmbti/complete", base).href;
      }
      return new URL("../api/petsmbti/complete", u.href).href;
    } catch (e) {
      return "/api/petsmbti/complete";
    }
  }

  global.reportPetsmbtiQuizComplete = function reportPetsmbtiQuizComplete(pet, code) {
    return fetch(resolveCompleteUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet: pet, code: code }),
      keepalive: true,
    });
  };
})(typeof window !== "undefined" ? window : this);
