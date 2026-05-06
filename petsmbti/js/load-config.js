/**
 * 从 JSON 加载题库与结果文案，写入 window.PETS_MBTI_QUESTIONS / PETS_MBTI_RESULTS
 * 默认路径：与当前页同源的 data/pets-mbti.json
 * 可通过 ?config=路径.json 覆盖（相对当前页面 URL）
 */
(function (global) {
  function resolveConfigUrl() {
    try {
      var u = new URL(global.location.href);
      var custom = u.searchParams.get("config");
      if (custom) return new URL(custom, global.location.href).href;
    } catch (e) {}
    return new URL("data/pets-mbti.json", global.location.href).href;
  }

  global.loadPetsMbtiConfig = function loadPetsMbtiConfig() {
    var url = resolveConfigUrl();
    return fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " — " + url);
        return r.json();
      })
      .then(function (cfg) {
        if (!cfg || typeof cfg !== "object") throw new Error("配置不是对象");
        if (!cfg.questions || !cfg.results) throw new Error("缺少 questions 或 results");
        global.PETS_MBTI_QUESTIONS = cfg.questions;
        global.PETS_MBTI_RESULTS = {
          typeOrder: cfg.results.typeOrder || [],
          titles: cfg.results.titles || {},
          blurbs: cfg.results.blurbs || {},
        };
        global.PETS_MBTI_CONFIG = cfg;
        return cfg;
      });
  };
})(typeof window !== "undefined" ? window : globalThis);
