/**
 * GET /api/laufey/stats
 * 键：laufey_quiz_kv_day_<YYYYMMDD>_<slug>
 * 返回明细 bySongDay，并聚合 total、byDay（每日合计）、byResult（各曲总数与占比）
 * KV 绑定变量名：laufeyquizstats
 */

var KV_KEY_PREFIX = "laufey_quiz_kv_";
var LIST_PREFIX = KV_KEY_PREFIX + "day_";

var SLUG_TO_TITLE = {
  s01: "Carousel",
  s02: "Forget-Me-Not",
  s03: "Too Little, Too Late",
  s04: "Castle in Hollywood",
  s05: "Letter To My 13 Year Old Self",
  s06: "Dreamer",
  s07: "Lover Girl",
  s08: "Valentine (Jazz Version)",
  s09: "From the Start",
  s10: "Clockwork",
  s11: "Falling Behind",
  s12: "Silver Lining",
  s13: "Bored",
  s14: "Promise",
  s15: "Mr. Eclectic",
  s16: "Goddess",
  s17: "Tough Luck",
  s18: "Snow White",
  s19: "Sabotage",
  s20: "Let You Break My Heart Again"
};

var ALL_SLUGS = [
  "s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09", "s10",
  "s11", "s12", "s13", "s14", "s15", "s16", "s17", "s18", "s19", "s20"
];

function getKv(env) {
  if (env && env.laufeyquizstats) return env.laufeyquizstats;
  if (typeof laufeyquizstats !== "undefined") return laufeyquizstats;
  return null;
}

function parseDaySongKey(fullKey) {
  if (!fullKey || fullKey.indexOf(LIST_PREFIX) !== 0) return null;
  var rest = fullKey.slice(LIST_PREFIX.length);
  var m = /^(\d{8})_(s\d{2})$/.exec(rest);
  if (!m) return null;
  return { ymd: m[1], slug: m[2] };
}

function aggregateFromSongDay(bySongDay) {
  var total = 0;
  var dayAgg = {};
  var songAgg = {};
  var i;
  var sl;
  var row;
  var dKey;

  for (i = 0; i < ALL_SLUGS.length; i++) {
    sl = ALL_SLUGS[i];
    songAgg[sl] = { slug: sl, title: SLUG_TO_TITLE[sl], count: 0, percent: 0 };
  }

  for (i = 0; i < bySongDay.length; i++) {
    row = bySongDay[i];
    total += row.count;
    dayAgg[row.date] = (dayAgg[row.date] || 0) + row.count;
    if (songAgg[row.slug]) songAgg[row.slug].count += row.count;
  }

  var byDay = [];
  for (dKey in dayAgg) {
    if (Object.prototype.hasOwnProperty.call(dayAgg, dKey)) {
      byDay.push({ date: dKey, count: dayAgg[dKey] });
    }
  }
  byDay.sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });

  var byResult = [];
  for (i = 0; i < ALL_SLUGS.length; i++) {
    byResult.push(songAgg[ALL_SLUGS[i]]);
  }
  byResult.sort(function (a, b) {
    return b.count - a.count || a.slug.localeCompare(b.slug);
  });
  for (i = 0; i < byResult.length; i++) {
    row = byResult[i];
    row.percent =
      total > 0 ? Math.round((row.count / total) * 10000) / 100 : 0;
  }

  return { total: total, byDay: byDay, byResult: byResult };
}

export async function onRequestGet(context) {
  var kv = getKv(context.env);
  if (!kv) {
    return new Response(JSON.stringify({ ok: false, error: "KV_not_bound_set_laufeyquizstats" }), {
      status: 503,
      headers: jsonHeaders()
    });
  }

  try {
    var bySongDay = [];
    var listUnavailable = false;
    var listUnavailableDetail = "";

    if (typeof kv.list !== "function") {
      listUnavailable = true;
      listUnavailableDetail = "kv.list_not_supported";
    } else {
      try {
        var listCursor;
        var block;
        do {
          var listOpts = { prefix: LIST_PREFIX, limit: 1000 };
          if (listCursor) listOpts.cursor = listCursor;
          block = await kv.list(listOpts);
          var keyList = block.keys || [];
          for (var i = 0; i < keyList.length; i++) {
            var lk = keyList[i];
            var k = typeof lk === "string" ? lk : lk && (lk.key || lk.name);
            if (!k) continue;
            var parsed = parseDaySongKey(k);
            if (!parsed) continue;
            var v = await kv.get(k);
            var c = Number(v) || 0;
            if (c <= 0) continue;
            var ymd = parsed.ymd;
            var dateIso = ymd.slice(0, 4) + "-" + ymd.slice(4, 6) + "-" + ymd.slice(6, 8);
            var slug = parsed.slug;
            bySongDay.push({
              date: dateIso,
              slug: slug,
              title: SLUG_TO_TITLE[slug] || slug,
              count: c
            });
          }
          var listDone =
            block.complete === true ||
            block.list_complete === true;
          listCursor = listDone ? null : block.cursor || null;
        } while (listCursor);
      } catch (listErr) {
        bySongDay = [];
        listUnavailable = true;
        listUnavailableDetail =
          listErr && typeof listErr.message === "string"
            ? listErr.message.slice(0, 200)
            : "list_failed";
        try {
          console.error("[laufey/stats] list", listErr);
        } catch (logE) {}
      }
    }

    bySongDay.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (b.count !== a.count) return b.count - a.count;
      return (a.title || "").localeCompare(b.title || "");
    });

    var agg = aggregateFromSongDay(bySongDay);

    var payload = {
      ok: true,
      total: agg.total,
      sumResult: agg.total,
      dayCount: agg.byDay.length,
      byDay: agg.byDay,
      byResult: agg.byResult,
      bySongDay: bySongDay
    };
    if (listUnavailable) {
      payload.listUnavailable = true;
      if (listUnavailableDetail) payload.listUnavailableDetail = listUnavailableDetail;
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders() });
  } catch (err) {
    try {
      console.error("[laufey/stats]", err);
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
