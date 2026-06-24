/**
 * POST /api/quiz/complete
 * Body: { "title": "黑洞" } — 须为预设歌名之一
 *
 * EdgeOne Pages / Cloudflare Pages：将 KV 命名空间绑定为环境变量名 fnds_quiz_kv
 */
var TITLE_TO_SLUG = {
  "2001太空漫游": "s01",
  人神斗: "s02",
  当这地球没有花: "s03",
  时代巨轮: "s04",
  黑洞: "s05",
  兄妹: "s06",
  心的距离: "s07",
  我们: "s08",
  红玫瑰: "s09",
  异梦: "s10",
  告别娑婆: "s11",
  完: "s12",
  好久不见: "s13",
  任我行: "s14",
  大人: "s15",
  七百年后: "s16",
  人生马拉松: "s17",
  陪你度过漫长岁月: "s18",
  路一直都在: "s19",
  我们万岁: "s20"
};

function getKv(env) {
  if (env && env.fnds_quiz_kv) return env.fnds_quiz_kv;
  if (typeof fnds_quiz_kv !== "undefined") return fnds_quiz_kv;
  return null;
}

function dayKeyShanghai(d) {
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
  return "quiz_day_" + y + m + day;
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
    return new Response(JSON.stringify({ ok: false, error: "KV_not_bound_set_fnds_quiz_kv" }), {
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
    var total = await incr(kv, "quiz_total");
    await incr(kv, dayKeyShanghai(new Date()));
    var resultCount = await incr(kv, "quiz_res_" + slug);

    return new Response(
      JSON.stringify({
        ok: true,
        total: total,
        resultCount: resultCount,
        slug: slug
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
