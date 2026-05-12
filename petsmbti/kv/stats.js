/**
 * GET /api/petsmbti/stats — 服务端实现（路由入口：petsmbti/functions/api/petsmbti/stats.js）
 */

import { jsonHeaders, getPetsmbtiKv } from "./kvCore.js";

var PETS = ["cat", "dog", "parrot"];

var CODES = [
  "ESTJ",
  "ESFJ",
  "ESTP",
  "ESFP",
  "ENTJ",
  "ENFJ",
  "ENTP",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ISTP",
  "ISFP",
  "INTJ",
  "INFJ",
  "INTP",
  "INFP",
];

export async function onRequestGet(context) {
  var kv = getPetsmbtiKv(context.env);
  if (!kv) {
    return new Response(JSON.stringify({ ok: false, error: "KV_not_bound_set_petsmbti_quiz_kv" }), {
      status: 503,
      headers: jsonHeaders(),
    });
  }

  try {
    var total = Number(await kv.get("petsmbti_total")) || 0;

    var byPet = {};
    for (var pi = 0; pi < PETS.length; pi++) {
      var p = PETS[pi];
      byPet[p] = Number(await kv.get("petsmbti_pet_" + p)) || 0;
    }

    var combos = [];
    for (var i = 0; i < PETS.length; i++) {
      var pet = PETS[i];
      for (var j = 0; j < CODES.length; j++) {
        var code = CODES[j];
        var c = Number(await kv.get("petsmbti_combo_" + pet + "_" + code)) || 0;
        combos.push({
          pet: pet,
          code: code,
          count: c,
          percentTotal: total > 0 ? Math.round((c / total) * 10000) / 100 : 0,
        });
      }
    }

    combos.sort(function (a, b) {
      return b.count - a.count;
    });

    return new Response(
      JSON.stringify({
        ok: true,
        total: total,
        byPet: byPet,
        combos: combos,
      }),
      { status: 200, headers: jsonHeaders() }
    );
  } catch (err) {
    try {
      console.error("[petsmbti/kv/stats]", err);
    } catch (logErr) {}
    var msg = err && (err.message || String(err));
    return new Response(
      JSON.stringify({
        ok: false,
        error: "kv_read_failed",
        detail: typeof msg === "string" ? msg.slice(0, 200) : "",
      }),
      { status: 500, headers: jsonHeaders() }
    );
  }
}
