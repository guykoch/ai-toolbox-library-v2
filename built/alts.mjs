// stub:server
var id = (d) => d;
var internalQuery = id;
var internalMutation = id;
var internalAction = id;

// convex/alts.ts
import { v } from "convex/values";

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/llm.ts
import { ConvexError } from "convex/values";

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
async function callGemini(opts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ConvexError("GEMINI_API_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  const generationConfig = { maxOutputTokens: opts.maxTokens ?? 8192 };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  if (opts.thinking) generationConfig.thinkingConfig = { thinkingLevel: opts.thinking };
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.turns.map((t) => ({ role: t.role, parts: [...(t.images || []).map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })), { text: t.text }] })),
    generationConfig
  };
  if (opts.search) body.tools = [{ google_search: {} }];
  const send = async (b) => {
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
      { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: JSON.stringify(b) },
      24e4
    );
    const j2 = await r.json().catch(() => ({}));
    return { ok: r.ok, j: j2 };
  };
  let { ok, j } = await send(body);
  if (!ok && /thinking|responseMimeType|google_search|tool/i.test(JSON.stringify(j?.error ?? ""))) {
    const plain = { ...body, generationConfig: { maxOutputTokens: generationConfig.maxOutputTokens } };
    if (opts.json && !opts.search) plain.generationConfig.responseMimeType = "application/json";
    ({ ok, j } = await send(plain));
  }
  if (!ok) throw new ConvexError("Gemini API error: " + (j?.error?.message || "unknown error"));
  const cand = j?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (!text) throw new ConvexError("Gemini returned an empty answer" + (cand?.finishReason ? ` (${cand.finishReason})` : "") + ". Try again.");
  const seen = /* @__PURE__ */ new Set();
  const sources = [];
  for (const c of cand?.groundingMetadata?.groundingChunks || []) {
    const url = c?.web?.uri;
    const title = c?.web?.title || "";
    if (url && !seen.has(title + url)) {
      seen.add(title + url);
      sources.push({ title, url });
    }
  }
  return { text, sources };
}
function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end < start) throw new ConvexError("Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    throw new ConvexError("Couldn't read the AI's answer. Please try again.");
  }
}

// convex/alts.ts
var missing = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("items").collect();
    return rows.filter((r) => r.data && r.data.alternativeTo === void 0).map((r) => ({ id: r.itemId, title: r.data.title, summary: r.data.summary, kind: r.data.kind || "", host: r.data.host }));
  }
});
var save = internalMutation({
  args: { alts: v.array(v.object({ id: v.number(), list: v.array(v.string()) })) },
  handler: async (ctx, { alts }) => {
    for (const a of alts) {
      const row = await ctx.db.query("items").withIndex("by_itemId", (q) => q.eq("itemId", a.id)).first();
      if (row && row.data?.alternativeTo === void 0) await ctx.db.patch(row._id, { data: { ...row.data, alternativeTo: a.list } });
    }
  }
});
var fill = internalAction({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.runQuery(internal.alts.missing, {});
    for (let i = 0; i < all.length; i += 40) await fillBatch(ctx, all.slice(i, i + 40));
  }
});
async function fillBatch(ctx, items) {
  if (!items.length) return;
  const list = items.map((i) => `${i.id} | ${i.title} | ${String(i.summary || "").replace(/\s+/g, " ")} | ${i.kind} | ${i.host}`).join("\n");
  let parsed = null;
  try {
    const res = await callGemini({
      model: MODELS.advisor(),
      system: 'For each AI tool below, name up to 3 famous, widely known products on the market that it can replace or is an alternative to (most famous first). Use [] for guides, courses, posts to learn from, news and announcements. Reply JSON only: {"<id>": ["A","B","C"], ...}',
      turns: [{ role: "user", text: "id | title | summary | type | site\n" + list }],
      json: true,
      thinking: "low",
      maxTokens: 8192
    });
    parsed = parseJson(res.text);
  } catch (e) {
    console.log("alternatives fill failed", String(e));
    return;
  }
  const alts = items.filter((i) => Array.isArray(parsed?.[String(i.id)])).map((i) => ({ id: i.id, list: parsed[String(i.id)].map((x) => String(x).trim()).filter(Boolean).slice(0, 3) }));
  if (!alts.length) console.log("alternatives fill: no usable answer", String(parsed).slice(0, 200));
  if (alts.length) await ctx.runMutation(internal.alts.save, { alts });
}
export {
  fill,
  missing,
  save
};
