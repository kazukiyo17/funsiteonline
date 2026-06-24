/**
 * POST /api/laufey/complete
 * Body: { "title": "Carousel" } — 须与 lauverquiz/songs-meta.json 中歌名完全一致
 *
 * EdgeOne Pages：KV 绑定变量名 laufeyquizstats。
 * 仅写入「各曲 × 上海日历日」计数，键：laufey_quiz_kv_day_<YYYYMMDD>_<slug>
 */
var KV_KEY_PREFIX = "laufey_quiz_kv_";
var DAY_SLOT_PREFIX = KV_KEY_PREFIX + "day_";

var TITLE_TO_SLUG = {
  Carousel: "s01",
  "Forget-Me-Not": "s02",
  "Too Little, Too Late": "s03",
  "Castle in Hollywood": "s04",
  "Letter To My 13 Year Old Self": "s05",
  Dreamer: "s06",
  "Lover Girl": "s07",
  "Valentine (Jazz Version)": "s08",
  "From the Start": "s09",
  Clockwork: "s10",
  "Falling Behind": "s11",
  "Silver Lining": "s12",
  Bored: "s13",
  Promise: "s14",
  "Mr. Eclectic": "s15",
  Goddess: "s16",
  "Tough Luck": "s17",
  "Snow White": "s18",
  Sabotage: "s19",
  "Let You Break My Heart Again": "s20"
};

function getKv(env) {
  if (env && env.laufeyquizstats) return env.laufeyquizstats;
  if (typeof laufeyquizstats !== "undefined") return laufeyquizstats;
  return null;
}

/** 上海时区当日 YYYYMMDD */
function dateYmdShanghai(d) {
  var parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  var y, m, day;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === "year") y = parts[i].value;
    if (parts[i].type === "month") m = parts[i].value;
    if (parts[i].type === "day") day = parts[i].value;
  }
  return y + m + day;
}

function daySongKey(ymd, slug) {
  return DAY_SLOT_PREFIX + ymd + "_" + slug;
}

async function incr(kv, key) {
  var raw = await kv.get(key);
  var n = (Number(raw) || 0) + 1;
  await kv.put(key, String(n));
  return n;
}

export async function onRequestPost(context) {
  var kv = getKv(context.env);
  if (!kv) {
    return new Response(JSON.stringify({ ok: false, error: "KV_not_bound_set_laufeyquizstats" }), {
      status: 503,
      headers: jsonHeaders()
    });
  }

  var title;
  try {
    var body = await context.request.json();
    title = body && body.title;
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: jsonHeaders()
    });
  }

  if (!title || typeof title !== "string") {
    return new Response(JSON.stringify({ ok: false, error: "missing_title" }), {
      status: 400,
      headers: jsonHeaders()
    });
  }

  var slug = TITLE_TO_SLUG[title];
  if (!slug) {
    return new Response(JSON.stringify({ ok: false, error: "unknown_title" }), {
      status: 400,
      headers: jsonHeaders()
    });
  }

  try {
    var ymd = dateYmdShanghai(new Date());
    var key = daySongKey(ymd, slug);
    var count = await incr(kv, key);
    var dateIso =
      ymd.length === 8
        ? ymd.slice(0, 4) + "-" + ymd.slice(4, 6) + "-" + ymd.slice(6, 8)
        : ymd;

    return new Response(
      JSON.stringify({
        ok: true,
        date: dateIso,
        slug: slug,
        count: count
      }),
      { status: 200, headers: jsonHeaders() }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "kv_write_failed" }), {
      status: 500,
      headers: jsonHeaders()
    });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}

function jsonHeaders() {
  return {
    "content-type": "application/json; charset=UTF-8",
    "Access-Control-Allow-Origin": "*"
  };
}
