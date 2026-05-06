/**
 * 问卷完成埋点（前端）→ POST /api/petsmbti/complete
 */
(function (global) {
  var API_PATH = "/api/petsmbti/complete";

  global.reportPetsmbtiQuizComplete = function reportPetsmbtiQuizComplete(pet, code) {
    return fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet: pet, code: code }),
      keepalive: true,
    });
  };
})(typeof window !== "undefined" ? window : this);
