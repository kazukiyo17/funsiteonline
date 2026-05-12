/**

 * 统计页拉取 KV 汇总 → GET …/api/petsmbti/stats

 * 默认相对当前页：../api/…（与 quiz 等同目录部署时，子路径站点也能命中 Functions）

 * 覆盖：地址栏 ?apiRoot=https://你的域名 或 ?apiRoot=https://你的域名/子路径

 */

(function (global) {

  function resolveStatsUrl() {

    try {

      var u = new URL(global.location.href);

      var root = u.searchParams.get("apiRoot");

      if (root) {

        var base = String(root).replace(/\/?$/, "/");

        return new URL("api/petsmbti/stats", base).href;

      }

      return new URL("../api/petsmbti/stats", u.href).href;

    } catch (e) {

      return "/api/petsmbti/stats";

    }

  }



  global.fetchPetsmbtiStats = function fetchPetsmbtiStats() {

    var url = resolveStatsUrl();

    return fetch(url, { credentials: "same-origin" }).then(function (r) {

      return r.text().then(function (text) {

        var trimmed = text.trim();

        var ct = (r.headers.get("content-type") || "").toLowerCase();

        if (

          trimmed.charAt(0) === "<" &&

          (!ct.includes("application/json") || trimmed.slice(0, 9).toLowerCase() === "<!doctype")

        ) {

          throw new Error(

            "接口返回了 HTML 而不是 JSON（多为 404 或未走 Edge Functions）。请用已部署且绑定了 /api 的站点打开；若问卷在子路径下，本页已默认请求「上一级」的 ../api/…，仍不对可在地址栏追加 ?apiRoot=https://你的站点根或含子路径的基址"

          );

        }

        var data;

        try {

          data = JSON.parse(text);

        } catch (parseErr) {

          throw new Error("响应不是合法 JSON：" + (parseErr && parseErr.message ? parseErr.message : String(parseErr)));

        }

        return { ok: r.ok, data: data };

      });

    });

  };

})(typeof window !== "undefined" ? window : this);

