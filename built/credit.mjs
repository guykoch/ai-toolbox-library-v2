// stub:server
var id = (d) => d;
var action = id;

// convex/credit.ts
import { v } from "convex/values";

// convex/auth.ts
import { ConvexError } from "convex/values";
function checkKey(key) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new ConvexError("ADMIN_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  }
  if (key !== expected) {
    throw new ConvexError("Wrong access key.");
  }
}

// convex/web.ts
async function fetchWithTimeout(url, init = {}, ms = 12e3) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

// convex/llm.ts
import { ConvexError as ConvexError2 } from "convex/values";
var MODELS = {
  // Researches how to install a tool and writes the install prompt (uses Google Search).
  install: () => process.env.GEMINI_MODEL_INSTALL || "gemini-3.8-flash",
  // Answers "What would you like to do?" from your library.
  advisor: () => process.env.GEMINI_MODEL_ADVISOR || "gemini-3.8-flash",
  // Re-scores hype for "Update hype scores" (uses Google Search).
  hype: () => process.env.GEMINI_MODEL_HYPE || "gemini-3.8-flash",
  // Writes new cards from what you paste (Claude if ANTHROPIC_API_KEY is set, otherwise Gemini).
  addClaude: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  addGemini: () => process.env.GEMINI_MODEL_ADD || "gemini-3.8-flash"
};

// convex/credit.ts
var check = action({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    checkKey(key);
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { status: "missing", detail: "GEMINI_API_KEY isn't set in Convex (Settings \u2192 Environment Variables).", checkedAt };
    const tryModel = async (model) => {
      const r = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with: ok" }] }], generationConfig: { maxOutputTokens: 5 } })
        },
        3e4
      );
      const j = await r.json().catch(() => ({}));
      return { code: r.status, msg: String(j?.error?.message || "") };
    };
    try {
      let res = await tryModel(process.env.GEMINI_MODEL_CHECK || "gemini-3.5-flash-lite");
      if (res.code === 404) res = await tryModel(MODELS.advisor());
      const { code, msg } = res;
      if (code >= 200 && code < 300) return { status: "ok", detail: "Gemini answered normally, so you have credit.", checkedAt };
      if (code === 402 || /prepay|credits are depleted|billing|payment/i.test(msg))
        return { status: "no_credit", detail: "Your prepaid credit has run out. Add credit on the AI Studio billing page.", checkedAt };
      if (code === 400 && /API key/i.test(msg) || code === 401 || code === 403)
        return { status: "key", detail: "Google rejected the API key. Check GEMINI_API_KEY in Convex. " + msg.slice(0, 160), checkedAt };
      if (code === 429)
        return { status: "busy", detail: "Too many requests right now (rate limit), not a credit problem. Try again in a minute.", checkedAt };
      return { status: "error", detail: `Unexpected answer from Google (HTTP ${code}). ${msg.slice(0, 160)}`, checkedAt };
    } catch (e) {
      return { status: "error", detail: "Couldn't reach Google: " + String(e?.message || e).slice(0, 160), checkedAt };
    }
  }
});
export {
  check
};
