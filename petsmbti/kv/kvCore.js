/**

 * 宠物 MBTI — KV 请求辅助（仅本模块使用）

 */



export async function incr(kv, key) {

  var raw = await kv.get(key);

  var n = (Number(raw) || 0) + 1;

  await kv.put(key, String(n));

  return n;

}



export function jsonHeaders() {

  return {

    "content-type": "application/json; charset=UTF-8",

    "Access-Control-Allow-Origin": "*",

  };

}



export function corsOptionsPost() {

  return new Response(null, {

    status: 204,

    headers: {

      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Methods": "POST, OPTIONS",

      "Access-Control-Allow-Headers": "Content-Type",

      "Access-Control-Max-Age": "86400",

    },

  });

}



export async function readJson(request) {

  try {

    return await request.json();

  } catch (e) {

    return null;

  }

}



/** EdgeOne / Workers：优先 env 绑定，其次历史全局变量名 */

export function getPetsmbtiKv(env) {

  if (env && env.petsmbti_quiz_kv) return env.petsmbti_quiz_kv;

  if (typeof petsmbti_quiz_kv !== "undefined") return petsmbti_quiz_kv;

  return null;

}

