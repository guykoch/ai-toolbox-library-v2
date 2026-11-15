import { action } from "./_generated/server";
import { v } from "convex/values";
import { checkKey } from "./auth";
import { fetchWithTimeout } from "./web";
import { MODELS } from "./llm";

// ---------------------------------------------------------------------------
// "Gemini credit" button: Google has no API for the prepaid balance, so this
// sends one tiny request (a few tokens, a tiny fraction of a cent) and reports
// whether Gemini is working or out of credit. The real balance is on
// https://aistudio.google.com/billing.
// ---------------------------------------------------------------------------

type CreditStatus = { status: "ok" | "no_credit" | "key" | "missing" | "busy" | "error"; detail: string; checkedAt: string };

export const check = action({
  args: { key: v.string() },
  handler: async (_ctx, { key }): Promise<CreditStatus> => {
    checkKey(key);
    const checkedAt = new Date().toISOString();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { status: "missing", detail: "GEMINI_API_KEY isn't set in Convex (Settings → Environment Variables).", checkedAt };

    const tryModel = async (model: string) => {
      const r = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with: ok" }] }], generationConfig: { maxOutputTokens: 5 } }),
        },
        30000,
      );
      const j: any = await r.json().catch(() => ({}));
      return { code: r.status, msg: String(j?.error?.message || "") };
    };

    try {
      // Cheapest model first; fall back to the one the app uses if that name isn't available.
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
    } catch (e: any) {
      return { status: "error", detail: "Couldn't reach Google: " + String(e?.message || e).slice(0, 160), checkedAt };
    }
  },
});
