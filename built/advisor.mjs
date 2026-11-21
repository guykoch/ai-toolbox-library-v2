// stub:server
var id = (d) => d;
var action = id;

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/advisor.ts
import { v, ConvexError as ConvexError3 } from "convex/values";

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

// convex/kinds.ts
var KINDS = ["skill", "connector", "plugin", "webapp", "app", "devtool", "model", "learn", "news"];
var KIND_LABEL = {
  skill: "Skill",
  connector: "Connector (MCP)",
  plugin: "Plugin / extension",
  webapp: "Web app",
  app: "Desktop / phone app",
  devtool: "Developer tool",
  model: "AI model",
  learn: "Learn",
  news: "News"
};
function guessKind(it) {
  if (KINDS.includes(it?.kind)) return it.kind;
  const t = `${it?.title || ""} ${it?.summary || ""}`.toLowerCase();
  const url = String(it?.url || "").toLowerCase();
  const type = String(it?.type || "");
  if (type === "news") return "news";
  if (["guide", "course", "video", "post"].includes(type) || /youtube\.com|youtu\.be/.test(url)) return "learn";
  const gh = /github\.com/.test(url) || type === "open-source-repo";
  if (/\bskills?\b|skill\.md/.test(t)) return "skill";
  if (/desktop app|mac app|menu bar|iphone|android|ios app|app store|windows, macos|for windows|desktop meeting|video editor|image editor|on-device/.test(t)) return "app";
  if (/\bmcp server\b|\bconnector\b/.test(t) && !/\bcli\b/.test(t)) return "connector";
  if (/extension|plugin|add-on/.test(t) || /chromewebstore|marketplace\.visualstudio/.test(url)) return "plugin";
  if (/open-weight|open weights|text-to-speech model|image model|diarization model/.test(t) || /huggingface\.co/.test(url)) return "model";
  if (gh || /\bcli\b|library|sdk|self-hosted|framework|api\b|apis\b/.test(t)) return "devtool";
  if (/\bnews\b|report|benchmark/.test(t)) return "news";
  return "webapp";
}

// convex/llm.ts
import { ConvexError as ConvexError2 } from "convex/values";

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
  if (!key) throw new ConvexError2("GEMINI_API_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
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
  if (!ok) throw new ConvexError2("Gemini API error: " + (j?.error?.message || "unknown error"));
  const cand = j?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (!text) throw new ConvexError2("Gemini returned an empty answer" + (cand?.finishReason ? ` (${cand.finishReason})` : "") + ". Try again.");
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
  if (start < 0 || end < start) throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  }
}

// convex/advisor.ts
var SHELVES = {
  "coding-agents": "Coding agents",
  "agent-skills": "Agent skills",
  "courses-guides": "Courses & guides",
  productivity: "Productivity",
  "app-building": "App building",
  video: "Video",
  image: "Image",
  audio: "Audio",
  "ai-models": "AI models",
  "news-analysis": "News & analysis",
  translation: "Translation",
  other: "Other"
};
var SYSTEM = `You are the advisor for the user's personal library of saved AI tools and resources. The user tells you, in casual language (maybe with typos, shorthand, Hebrew or English), what they want to do. You recommend items FROM THEIR LIBRARY ONLY.

Rules:
- Only recommend items listed in LIBRARY, by their exact id. Never invent tools or recommend tools that aren't in the list. You may mention in "reply" that a well-known outside tool exists, but only as a note, never as a pick.
- Understand intent, not keywords: "make a vid" = video generation; "turn pdf into word" = PDF conversion; "pretty slides" = presentation/design tools; a guide or course that teaches the task counts as a weaker match than a tool that does it.
- Rank best first. Prefer: does the job directly > partly / with setup > teaches how. Within that, weigh hype score, open source when the user wants free/local, and fit to any constraints they mention (free, Hebrew, no code, local, fast...).
- 0 to 5 picks. If nothing in the library really fits, return no picks, say so plainly, and say what kind of tool they'd need.
- If the request is too vague to rank well, still give your best picks and ask ONE short follow-up question.
- Keep it short and plain-English. "why" = one sentence on why it fits; "tradeoff" = one short caveat or how it compares to the others (or "").
- The conversation may continue ("what about free ones?", "the second one \u2014 is it hard?"): use earlier turns for context.

Return ONLY JSON:
{"reply": "1-3 sentence direct answer", "picks": [{"id": <number>, "fit": "best" | "good" | "partial", "why": "...", "tradeoff": "..."}], "followup": "optional short question or empty string"}`;
function libraryText(items) {
  return items.map((i) => {
    const shelves = [i.cat, ...i.extra || []].map((c) => SHELVES[c] || c).join("/");
    const os = i.os === true ? "open-source" : i.os === false ? "not-OS" : "OS?";
    const summary = String(i.summary || "").replace(/\s+/g, " ");
    return `${i.id} | ${i.title} | ${summary} | ${shelves} | ${KIND_LABEL[guessKind(i)]} | ${os} | hype ${i.pop} | ${i.host}${i.lang === "he" ? " | Hebrew post" : ""}${i.alternativeTo?.length ? " | alt to " + i.alternativeTo.join(", ") : ""}`;
  }).join("\n");
}
var ask = action({
  args: {
    key: v.string(),
    messages: v.array(v.object({ role: v.union(v.literal("user"), v.literal("assistant")), text: v.string() }))
  },
  handler: async (ctx, { key, messages }) => {
    checkKey(key);
    const turns = messages.slice(-12).filter((m) => m.text.trim());
    if (!turns.length || turns[turns.length - 1].role !== "user") throw new ConvexError3("Type what you'd like to do first.");
    const items = await ctx.runQuery(internal.items.activeForAdvisor, {});
    if (!items.length) throw new ConvexError3("Your library is empty.");
    const byId = new Map(items.map((i) => [i.id, i]));
    const system = SYSTEM + `

LIBRARY (${items.length} items; columns: id | title | summary | shelf | type | open source | hype 1-100 | site | alternative to):
` + libraryText(items);
    const res = await callGemini({
      model: MODELS.advisor(),
      system,
      turns: turns.map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text.slice(0, 2e3) })),
      json: true,
      thinking: "medium",
      maxTokens: 4096
    });
    const raw = parseJson(res.text);
    const seen = /* @__PURE__ */ new Set();
    const picks = (Array.isArray(raw.picks) ? raw.picks : []).map((p) => ({ ...p, id: Number(p?.id) })).filter((p) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id)).slice(0, 5).map((p, i) => ({
      id: p.id,
      rank: i + 1,
      fit: ["best", "good", "partial"].includes(p.fit) ? p.fit : "good",
      why: String(p.why || "").trim(),
      tradeoff: String(p.tradeoff || "").trim()
    }));
    return {
      reply: String(raw.reply || (picks.length ? "" : "Nothing in your library fits that yet.")).trim(),
      picks,
      followup: String(raw.followup || "").trim()
    };
  }
});
export {
  ask
};
