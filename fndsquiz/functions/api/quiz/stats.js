/**
 * GET /api/quiz/stats
 * 返回 quiz_total（仅供参考）、按日、各结果次数及占比（相对曲目计数之和 sumResult）
 *
 * 控制台请将 Pages KV 命名空间绑定为环境变量名: fnds_quiz_kv
 */

var SLUG_TO_TITLE = {
  s01: "2001太空漫游",
  s02: "人神斗",
  s03: "当这地球没有花",
  s04: "时代巨轮",
  s05: "黑洞",
  s06: "兄妹",
  s07: "心的距离",
  s08: "我们",
  s09: "红玫瑰",
  s10: "异梦",
  s11: "告别娑婆",
  s12: "完",
  s13: "好久不见",
  s14: "任我行",
  s15: "大人",
  s16: "七百年后",
  s17: "人生马拉松",
  s18: "陪你度过漫长岁月",
  s19: "路一直都在",
  s20: "我们万岁"
};

var ALL_SLUGS = [
  "s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09", "s10",
  "s11", "s12", "s13", "s14", "s15", "s16", "s17", "s18", "s19", "s20"
];

function getKv(env) {
  if (env && env.fnds_quiz_kv) return env.fnds_quiz_kv;
  if (typeof fnds_quiz_kv !== "undefined") return fnds_quiz_kv;
  return null;
}

export async function onRequestGet(context) {
  var kv = getKv(context.env);
  if (!kv) {
    return new Response(JSON.stringify({ ok: false, error: "KV_not_bound_set_fnds_quiz_kv" }), {
      status: 503,
      headers: jsonHeaders()
    });
  }

  try {
    var totalRaw = await kv.get("quiz_total");
    var total = Number(totalRaw) || 0;

    var byDay = [];
    var byDayUnavailable = false;
    var byDayUnavailableDetail = "";
    try {
      var listCursor;
      var block;
      if (typeof kv.list !== "function") {
        byDayUnavailable = true;
        byDayUnavailableDetail = "kv.list_not_supported";
      } else {
        do {
          var listOpts = { prefix: "quiz_day_", limit: 256 };
          if (listCursor) listOpts.cursor = listCursor;
          block = await kv.list(listOpts);
          var keyList = block.keys || [];
          for (var i = 0; i < keyList.length; i++) {
            var lk = keyList[i];
            var k =
              typeof lk === "string" ? lk : lk && (lk.key || lk.name);
            if (!k) continue;
            var v = await kv.get(k);
            var dateStr = k.replace(/^quiz_day_/, "");
            if (dateStr.length === 8) {
              dateStr = dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6, 8);
            }
            byDay.push({ date: dateStr, count: Number(v) || 0 });
          }
          var listDone =
            block.complete === true ||
            block.list_complete === true;
          listCursor = listDone ? null : block.cursor || null;
        } while (listCursor);
      }
    } catch (dayErr) {
      byDay = [];
      byDayUnavailable = true;
      byDayUnavailableDetail =
        dayErr && typeof dayErr.message === "string" ? dayErr.message.slice(0, 200) : "day_list_failed";
      try {
        console.error("[quiz/stats] byDay", dayErr);
      } catch (logDay) {}
    }

    byDay.sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });

    var byResult = [];
    var sumResult = 0;
    for (var j = 0; j < ALL_SLUGS.length; j++) {
      var slug = ALL_SLUGS[j];
      var rk = "quiz_res_" + slug;
      var c = Number(await kv.get(rk)) || 0;
      sumResult += c;
      var title = SLUG_TO_TITLE[slug];
      byResult.push({
        title: title,
        slug: slug,
        count: c,
        percent: 0
      });
    }

    byResult.sort(function (a, b) {
      return b.count - a.count;
    });

    for (var p = 0; p < byResult.length; p++) {
      var br = byResult[p];
      br.percent =
        sumResult > 0 ? Math.round((br.count / sumResult) * 10000) / 100 : 0;
    }

    var payload = {
      ok: true,
      total: total,
      sumResult: sumResult,
      byDay: byDay,
      byResult: byResult
    };
    if (byDayUnavailable) {
      payload.byDayUnavailable = true;
      if (byDayUnavailableDetail) payload.byDayUnavailableDetail = byDayUnavailableDetail;
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders() });
  } catch (err) {
    try {
      console.error("[quiz/stats]", err);
    } catch (logErr) {}
    var msg = err && (err.message || String(err));
    return new Response(
      JSON.stringify({
        ok: false,
        error: "kv_read_failed",
        detail: typeof msg === "string" ? msg.slice(0, 200) : ""
      }),
      { status: 500, headers: jsonHeaders() }
    );
  }
}

function jsonHeaders() {
  return {
    "content-type": "application/json; charset=UTF-8",
    "Access-Control-Allow-Origin": "*"
  };
}
