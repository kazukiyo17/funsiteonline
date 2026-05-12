/**
 * POST /api/petsmbti/complete — 服务端实现（路由入口：petsmbti/functions/api/petsmbti/complete.js）
 */

import { incr, jsonHeaders, readJson, getPetsmbtiKv, corsOptionsPost } from "./kvCore.js";

export { corsOptionsPost };

var MISSING_ERR = "KV_not_bound_set_petsmbti_quiz_kv";

var VALID_PETS = { cat: true, dog: true, parrot: true };

var VALID_CODES = {
  ESTJ: true,
  ESFJ: true,
  ESTP: true,
  ESFP: true,
  ENTJ: true,
  ENFJ: true,
  ENTP: true,
  ENFP: true,
  ISTJ: true,
  ISFJ: true,
  ISTP: true,
  ISFP: true,
  INTJ: true,
  INFJ: true,
  INTP: true,
  INFP: true,
};

function jsonError(status, error, extra) {
  var o = { ok: false, error: error };
  if (extra && typeof extra === "object") {
    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    }
  }
  return new Response(JSON.stringify(o), { status: status, headers: jsonHeaders() });
}

function validate(body) {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  var pet = body.pet;
  var code = body.code;
  if (!pet || typeof pet !== "string" || !VALID_PETS[pet]) return { error: "invalid_pet" };
  if (!code || typeof code !== "string") return { error: "missing_code" };
  code = String(code).toUpperCase();
  if (!VALID_CODES[code]) return { error: "invalid_code" };
  return { data: { pet: pet, code: code } };
}

function incrementKeys(data) {
  return ["petsmbti_total", "petsmbti_pet_" + data.pet, "petsmbti_combo_" + data.pet + "_" + data.code];
}

function buildResponse(results, data) {
  return {
    ok: true,
    quiz: "petsmbti",
    total: results["petsmbti_total"],
    petTotal: results["petsmbti_pet_" + data.pet],
    comboTotal: results["petsmbti_combo_" + data.pet + "_" + data.code],
  };
}

/**
 * @param {object|null} bodyParsed - null 则从 request 读 JSON
 */
export async function runPetsmbtiComplete(context, bodyParsed) {
  var kv = getPetsmbtiKv(context.env);
  if (!kv) {
    return jsonError(503, MISSING_ERR);
  }

  var body = bodyParsed;
  if (body === null || body === undefined) {
    body = await readJson(context.request);
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "invalid_json");
  }

  var val = validate(body);
  if (val.error) {
    return jsonError(400, val.error);
  }

  var keys = incrementKeys(val.data);
  var results = {};
  try {
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      results[key] = await incr(kv, key);
    }
    var payload = buildResponse(results, val.data);
    return new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders() });
  } catch (err) {
    try {
      console.error("[petsmbti/kv/track]", err);
    } catch (logErr) {}
    return jsonError(500, "kv_write_failed");
  }
}
