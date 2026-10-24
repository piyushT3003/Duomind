/*
 * DuoMind configuration — Vercel (hosted) version
 * The Gemini key is NOT here. It is stored on Vercel as the environment variable GEMINI_API_KEY
 * and used only by api/gemini.js, so visitors never see it.
 * Leave GEMINI_API_KEY empty in this file.
 */
window.DUOMIND_CONFIG = {
  GEMINI_API_KEY: "",
  GEMINI_PROXY: "/api/gemini",
  GEMINI_MODEL: "gemini-3.8-flash",
  GEMINI_FAST_MODEL: "gemini-3.5-flash-lite"
};
